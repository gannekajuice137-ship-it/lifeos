#!/usr/bin/env node

// PageCrypt — encrypts all HTML files in the Next.js export output
// Uses AES-256-GCM with the passphrase from environment variable PAGECRYPT_PASSPHRASE

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { createCipheriv, pbkdf2Sync, randomBytes } from "crypto";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// We use a lightweight implementation of PageCrypt-compatible encryption
// This produces output that the PageCrypt client-side unlock page can decrypt

const PASSPHRASE = process.env.PAGECRYPT_PASSPHRASE;
if (!PASSPHRASE) {
  console.error("PAGECRYPT_PASSPHRASE environment variable is required");
  process.exit(1);
}

const OUTPUT_DIR = process.argv[2] || join(__dirname, "..", "out");

// PBKDF2-SHA256 key derivation (matches the browser Web Crypto unlock script)
function deriveKey(passphrase, salt) {
  return pbkdf2Sync(passphrase, salt, 10000, 32, "sha256");
}

function encrypt(plaintext, passphrase) {
  const salt = randomBytes(16);
  const key = deriveKey(passphrase, salt);
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: base64(salt) + ":" + base64(iv) + ":" + base64(encrypted) + ":" + base64(authTag)
  return [
    salt.toString("base64"),
    iv.toString("base64"),
    encrypted.toString("base64"),
    authTag.toString("base64"),
  ].join(":");
}

function processDirectory(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (extname(entry) === ".html") {
      encryptFile(fullPath);
    }
  }
}

function encryptFile(filePath) {
  const html = readFileSync(filePath, "utf8");
  const encrypted = encrypt(html, PASSPHRASE);

  // Create the unlock page wrapper
  const unlockPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Life OS — Locked</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
      background: #0e0e11;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #f5f5f7;
    }
    body::before, body::after {
      content: "";
      position: fixed;
      border-radius: 50%;
      filter: blur(90px);
      z-index: 0;
      pointer-events: none;
    }
    body::before { width: 480px; height: 380px; top: -120px; left: -80px; background: rgba(10,132,255,0.16); }
    body::after { width: 480px; height: 380px; bottom: -140px; right: -80px; background: rgba(191,90,242,0.14); }
    .card {
      position: relative;
      z-index: 1;
      background: rgba(24,24,29,0.9);
      backdrop-filter: blur(24px) saturate(160%);
      border-radius: 20px;
      padding: 3rem 2.5rem;
      width: 100%;
      max-width: 380px;
      text-align: center;
      box-shadow: 0 12px 48px rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .icon {
      width: 64px; height: 64px;
      margin: 0 auto 1.5rem;
      border-radius: 18px;
      background: linear-gradient(135deg, #0a84ff, #bf5af2);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 6px 20px rgba(191,90,242,0.4);
    }
    .icon svg { width: 30px; height: 30px; stroke: #fff; fill: none; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
    p { font-size: 0.875rem; color: #9a9aa2; margin-bottom: 1.5rem; }
    input {
      width: 100%;
      padding: 0.6rem 0.8rem;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.16);
      background: #0e0e11;
      color: #f5f5f7;
      font-size: 0.875rem;
      outline: none;
      margin-bottom: 0.75rem;
      font-family: inherit;
    }
    input:focus { border-color: #0a84ff; box-shadow: 0 0 0 3px rgba(10,132,255,0.2); }
    button {
      width: 100%;
      padding: 0.75rem;
      border-radius: 10px;
      border: none;
      background: #0a84ff;
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 150ms;
      box-shadow: 0 2px 12px rgba(10,132,255,0.35);
    }
    button:hover { background: #409cff; }
    button:active { transform: scale(0.97); background: #0077ed; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #ff453a; font-size: 0.8rem; margin-top: 0.5rem; }
    .forget-link { display: block; margin-top: 0.75rem; font-size: 0.8rem; color: #9a9aa2; text-decoration: underline; cursor: pointer; }
    @media (prefers-color-scheme: light) {
      body { background: #f2f2f5; color: #1d1d1f; }
      body::before { background: rgba(0,113,227,0.12); }
      body::after { background: rgba(175,82,222,0.10); }
      .card { background: rgba(255,255,255,0.9); border-color: rgba(0,0,0,0.08); box-shadow: 0 12px 40px rgba(0,0,0,0.16); }
      .icon { background: linear-gradient(135deg, #0071e3, #af52de); }
      p { color: #6e6e73; }
      input { background: #fff; color: #1d1d1f; border-color: rgba(0,0,0,0.16); }
      input:focus { border-color: #0071e3; box-shadow: 0 0 0 3px rgba(0,113,227,0.15); }
      button { background: #0071e3; box-shadow: 0 2px 12px rgba(0,113,227,0.3); }
      button:hover { background: #0077ed; }
    }
    @media (prefers-reduced-motion: reduce) {
      * { transition: none !important; }
    }
  </style>
</head>
<body>
  <div class="card">
  <div class="icon">
      <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
    </div>
    <h1>Life OS</h1>
    <p>Enter your passphrase to unlock</p>
    <form id="unlock-form">
      <input type="password" id="passphrase" placeholder="Passphrase" autofocus autocomplete="off" />
      <button type="submit" id="unlock-btn">Unlock</button>
      <label style="display:flex;align-items:center;gap:0.4rem;margin-top:0.7rem;font-size:0.8rem;color:#9a9aa2;cursor:pointer;">
        <input type="checkbox" id="remember" checked style="margin:0;" /> Remember on this device
      </label>
    </form>
    <p class="error" id="error"></p>
    <a class="forget-link" id="forget">Use a different passphrase</a>
  </div>

  <script>
  (function() {
    // PageCrypt-compatible decryption
    var encrypted = ${JSON.stringify(encrypted)};
    var ERROR_MSG = "Wrong passphrase";

    // PBKDF2 key derivation
    function deriveKey(passphrase, salt) {
      var enc = new TextEncoder();
      return crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"])
        .then(function(keyMaterial) {
          return crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: 10000, hash: "SHA-256" },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"]
          );
        });
    }

    function base64Decode(str) {
      var binary = atob(str);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }

    function decrypt(data, passphrase) {
      var parts = data.split(":");
      var salt = base64Decode(parts[0]);
      var iv = base64Decode(parts[1]);
      var ciphertext = base64Decode(parts[2]);
      var authTag = base64Decode(parts[3]);

      // Combine ciphertext and auth tag
      var combined = new Uint8Array(ciphertext.length + authTag.length);
      combined.set(ciphertext, 0);
      combined.set(authTag, ciphertext.length);

      return deriveKey(passphrase, salt).then(function(key) {
        return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, combined);
      }).then(function(decrypted) {
        return new TextDecoder().decode(decrypted);
      });
    }

    function setError(msg) {
      var err = document.getElementById("error");
      if (err) err.textContent = msg || "";
    }

    function attempt(passphrase) {
      var btn = document.getElementById("unlock-btn");
      if (!passphrase) return;
      if (btn) { btn.disabled = true; btn.textContent = "Decrypting..."; }
      setError("");
      return decrypt(encrypted, passphrase).then(function(html) {
        if (document.getElementById("remember") && document.getElementById("remember").checked) {
          try { localStorage.setItem("lifeos_site_pass", passphrase); } catch (e) {}
        }
        document.open();
        document.write(html);
        document.close();
      }).catch(function() {
        if (btn) { btn.disabled = false; btn.textContent = "Unlock"; }
        setError(ERROR_MSG);
        try { localStorage.removeItem("lifeos_site_pass"); } catch (e) {}
      });
    }

    document.getElementById("unlock-form").addEventListener("submit", function(e) {
      e.preventDefault();
      attempt(document.getElementById("passphrase").value);
    });

    var forget = document.getElementById("forget");
    if (forget) forget.addEventListener("click", function() {
      try { localStorage.removeItem("lifeos_site_pass"); } catch (e) {}
      document.getElementById("passphrase").value = "";
      setError("");
      document.getElementById("passphrase").focus();
    });

    // Auto-unlock if a remembered passphrase exists
    var saved = null;
    try { saved = localStorage.getItem("lifeos_site_pass"); } catch (e) {}
    if (saved) {
      document.getElementById("passphrase").value = saved;
      attempt(saved);
    }
  })();
  </script>
</body>
</html>`;

  writeFileSync(filePath, unlockPage);
  console.log(`  Encrypted: ${filePath}`);
}

console.log(`Encrypting HTML files in ${OUTPUT_DIR}...`);
processDirectory(OUTPUT_DIR);
console.log("Done! All HTML files are encrypted.");
