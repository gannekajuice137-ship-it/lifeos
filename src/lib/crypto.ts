// Client-side AES-GCM encryption module
// All user content is encrypted before leaving the browser

const PBKDF2_ITERATIONS = 210_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

type ByteArray = Uint8Array<ArrayBuffer>;

function base64Encode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Decode(str: string): ByteArray {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(
  passphrase: string,
  salt: ByteArray
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

function generateSalt(): ByteArray {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

function generateIV(): ByteArray {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

// Generate a printable recovery key (base64url, 32 bytes = 43 chars)
export function generateRecoveryKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Use base64url encoding (no padding, URL-safe)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function encryptString(
  plaintext: string,
  passphrase: string,
  salt?: ByteArray
): Promise<{ ciphertext: string; salt: string }> {
  const effectiveSalt = salt || generateSalt();
  const key = await deriveKey(passphrase, effectiveSalt);
  const iv = generateIV();
  const encoder = new TextEncoder();

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  // Format: base64(iv).base64(ciphertext+authTag)
  const ciphertext = base64Encode(iv) + "." + base64Encode(new Uint8Array(encrypted));
  return { ciphertext, salt: base64Encode(effectiveSalt) };
}

export async function decryptString(
  encryptedPayload: string,
  passphrase: string,
  salt: string
): Promise<string> {
  const saltBytes = base64Decode(salt);
  const key = await deriveKey(passphrase, saltBytes);

  const [ivB64, cipherB64] = encryptedPayload.split(".");
  const iv = base64Decode(ivB64);
  const cipherData = base64Decode(cipherB64);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
    key,
    cipherData as unknown as BufferSource
  );

  return new TextDecoder().decode(decrypted);
}

export async function encryptBytes(
  data: ByteArray,
  passphrase: string,
  salt: ByteArray
): Promise<ByteArray> {
  const key = await deriveKey(passphrase, salt);
  const iv = generateIV();

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data as BufferSource
  );

  // Prepend IV to ciphertext
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.length);
  return result;
}

export async function decryptBytes(
  encryptedData: ByteArray,
  passphrase: string,
  salt: string
): Promise<ByteArray> {
  const saltBytes = base64Decode(salt);
  const key = await deriveKey(passphrase, saltBytes);

  const iv = encryptedData.slice(0, IV_LENGTH);
  const cipherData = encryptedData.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
    key,
    cipherData as unknown as BufferSource
  );

  return new Uint8Array(decrypted);
}

// Encrypt a JSON payload into a single string
export async function encryptPayload(
  payload: Record<string, unknown> | object,
  passphrase: string,
  salt: string
): Promise<{ ciphertext: string }> {
  const json = JSON.stringify(payload);
  const saltBytes = base64Decode(salt);
  const { ciphertext } = await encryptString(json, passphrase, saltBytes);
  return { ciphertext };
}

// Decrypt a payload string back to JSON
export async function decryptPayload<T = Record<string, unknown>>(
  ciphertext: string,
  passphrase: string,
  salt: string
): Promise<T> {
  const json = await decryptString(ciphertext, passphrase, salt);
  return JSON.parse(json);
}

// Initialize crypto for a user - returns salt (from DB or newly generated)
export async function initializeCrypto(
  passphrase: string,
  existingSalt?: string
): Promise<{ salt: string; recoveryKey: string; isNew: boolean }> {
  if (existingSalt) {
    return { salt: existingSalt, recoveryKey: "", isNew: false };
  }

  const saltBytes = generateSalt();
  const salt = base64Encode(saltBytes);
  const recoveryKey = generateRecoveryKey();

  // Verify we can derive the key
  await deriveKey(passphrase, saltBytes);

  return { salt, recoveryKey, isNew: true };
}
