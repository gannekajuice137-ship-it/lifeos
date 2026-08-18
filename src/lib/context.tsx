"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

interface AuthCryptoContextType {
  user: User | null;
  loading: boolean;
  passphrase: string;
  cryptoSalt: string;
  isUnlocked: boolean;
  setPassphrase: (passphrase: string, salt: string) => void;
  lock: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  recoveryKey: string;
  setRecoveryKey: (key: string) => void;
}

const AuthCryptoContext = createContext<AuthCryptoContextType | null>(null);

export function useAuthCrypto() {
  const ctx = useContext(AuthCryptoContext);
  if (!ctx) throw new Error("useAuthCrypto must be used within AuthCryptoProvider");
  return ctx;
}

// Cookie helpers
function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

const PASSPHRASE_COOKIE = "lifeos_passphrase";
const SALT_COOKIE = "lifeos_salt";

export function AuthCryptoProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [passphrase, setPassphraseState] = useState("");
  const [cryptoSalt, setCryptoSalt] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Check for existing session and unlock state
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      // Check if already unlocked via cookie
      const savedPass = getCookie(PASSPHRASE_COOKIE);
      const savedSalt = getCookie(SALT_COOKIE);
      if (savedPass && savedSalt && session?.user) {
        setPassphraseState(savedPass);
        setCryptoSalt(savedSalt);
        setIsUnlocked(true);
      }

      setLoading(false);
    }
    init();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const setPassphrase = useCallback((pass: string, salt: string) => {
    setPassphraseState(pass);
    setCryptoSalt(salt);
    setIsUnlocked(true);
    // Persist in cookie for multi-page navigation
    setCookie(PASSPHRASE_COOKIE, pass, 30);
    setCookie(SALT_COOKIE, salt, 30);
  }, []);

  const lock = useCallback(async () => {
    setPassphraseState("");
    setCryptoSalt("");
    setIsUnlocked(false);
    setRecoveryKey("");
    deleteCookie(PASSPHRASE_COOKIE);
    deleteCookie(SALT_COOKIE);
    await supabase.auth.signOut();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await lock();
  }, [lock]);

  return (
    <AuthCryptoContext.Provider
      value={{
        user,
        loading,
        passphrase,
        cryptoSalt,
        isUnlocked,
        setPassphrase,
        lock,
        signIn,
        signOut,
        recoveryKey,
        setRecoveryKey,
      }}
    >
      {children}
    </AuthCryptoContext.Provider>
  );
}
