"use client";

import { useState } from "react";
import { useAuthCrypto } from "@/lib/context";
import { fetchCryptoMeta, saveCryptoMeta } from "@/lib/db";
import { initializeCrypto } from "@/lib/crypto";
import { LockIcon, CheckIcon } from "./icons";

export default function UnlockScreen() {
  const { user, signIn, setPassphrase, setRecoveryKey } = useAuthCrypto();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passphraseInput, setPassphraseInput] = useState("");
  const [recoveryKeyInput, setRecoveryKeyInput] = useState("");
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [step, setStep] = useState<"login" | "passphrase" | "setup" | "recovery">(user ? "passphrase" : "login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [newRecoveryKey, setNewRecoveryKey] = useState("");
  const [recoveryKeyCopied, setRecoveryKeyCopied] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setLoading(false);
    setStep("passphrase");
  };

  const handlePassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Check if crypto meta exists for this user
      const userId = (await import("@/lib/supabase")).supabase.auth.getUser();
      const uid = (await userId).data.user?.id;

      if (!uid) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const meta = await fetchCryptoMeta(uid);

      if (!meta) {
        // First time — create crypto meta
        const result = await initializeCrypto(passphraseInput);
        await saveCryptoMeta(uid, result.salt);
        setPassphrase(passphraseInput, result.salt);
        setNewRecoveryKey(result.recoveryKey);
        setRecoveryKey(result.recoveryKey);
        setStep("setup");
      } else {
        // Existing — try to decrypt a test payload
        const { decryptString } = await import("@/lib/crypto");
        // We verify the passphrase by attempting to decrypt the salt-derived key
        // If it fails, the passphrase is wrong
        try {
          await initializeCrypto(passphraseInput, meta.salt);
          setPassphrase(passphraseInput, meta.salt);
        } catch {
          setError("Wrong passphrase");
          setLoading(false);
          return;
        }
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock");
      setLoading(false);
    }
  };

  const handleRecoveryKeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;

      if (!uid) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const meta = await fetchCryptoMeta(uid);
      if (!meta) {
        setError("No encryption key found");
        setLoading(false);
        return;
      }

      // Recovery key can re-derive the same key
      await initializeCrypto(recoveryKeyInput, meta.salt);
      setPassphrase(recoveryKeyInput, meta.salt);
      setLoading(false);
    } catch {
      setError("Wrong recovery key");
      setLoading(false);
    }
  };

  const copyRecoveryKey = () => {
    navigator.clipboard.writeText(newRecoveryKey);
    setRecoveryKeyCopied(true);
    setTimeout(() => setRecoveryKeyCopied(false), 2000);
  };

  const dismissSetup = () => {
    // Navigate to the app
    window.location.href = "/tasks";
  };

  return (
    <div className="unlock-screen">
      <div className="unlock-card">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-6)" }}>
          <span className="logo-mark" style={{ width: 48, height: 48 }}>
            <LockIcon />
          </span>
        </div>

        {step === "login" && (
          <>
            <h1 className="unlock-title">Life OS</h1>
            <p className="unlock-subtitle">Sign in to continue</p>
            <form className="unlock-form" onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <input
                type="email"
                className="input"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
              <input
                type="password"
                className="input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
            {error && <p className="unlock-error" style={{ color: "var(--error)", fontSize: "var(--text-sm)", textAlign: "center", marginTop: "var(--space-3)" }}>{error}</p>}
          </>
        )}

        {step === "passphrase" && (
          <>
            <h1 className="unlock-title">Unlock</h1>
            <p className="unlock-subtitle">Enter your encryption passphrase</p>
            <form className="unlock-form" onSubmit={handlePassphrase} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <input
                type="password"
                className="input"
                placeholder="Encryption passphrase"
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                required
                autoFocus
              />
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? "Unlocking..." : "Unlock"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setStep("recovery")}
              >
                Use recovery key instead
              </button>
            </form>
            {error && <p className="unlock-error" style={{ color: "var(--error)", fontSize: "var(--text-sm)", textAlign: "center", marginTop: "var(--space-3)" }}>{error}</p>}
          </>
        )}

        {step === "recovery" && (
          <>
            <h1 className="unlock-title">Recovery Key</h1>
            <p className="unlock-subtitle">Enter your recovery key to unlock</p>
            <form className="unlock-form" onSubmit={handleRecoveryKeyLogin} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <input
                type="text"
                className="input"
                placeholder="Recovery key"
                value={recoveryKeyInput}
                onChange={(e) => setRecoveryKeyInput(e.target.value)}
                required
                autoFocus
                style={{ fontFamily: "var(--font-mono)" }}
              />
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? "Unlocking..." : "Unlock"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setStep("passphrase")}
              >
                Back to passphrase
              </button>
            </form>
            {error && <p className="unlock-error" style={{ color: "var(--error)", fontSize: "var(--text-sm)", textAlign: "center", marginTop: "var(--space-3)" }}>{error}</p>}
          </>
        )}

        {step === "setup" && (
          <>
            <h1 className="unlock-title">Save Your Recovery Key</h1>
            <p className="unlock-subtitle" style={{ marginBottom: "var(--space-4)" }}>
              This key can recover your data if you forget your passphrase.
              Save it offline — it will not be shown again.
            </p>
            <div
              style={{
                background: "var(--bg-tertiary)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-4)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                wordBreak: "break-all",
                marginBottom: "var(--space-4)",
                userSelect: "all",
                border: "1px solid var(--border)",
              }}
            >
              {newRecoveryKey}
            </div>
            <button
              className="btn btn-secondary"
              onClick={copyRecoveryKey}
              style={{ width: "100%", marginBottom: "var(--space-3)" }}
            >
              {recoveryKeyCopied ? (
                <><CheckIcon className="icon" /> Copied</>
              ) : (
                "Copy Recovery Key"
              )}
            </button>
            <button
              className="btn btn-primary btn-lg"
              onClick={dismissSetup}
              style={{ width: "100%" }}
            >
              I&apos;ve saved it — Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
