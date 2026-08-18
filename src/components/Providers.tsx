"use client";

import { AuthCryptoProvider } from "@/lib/context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthCryptoProvider>{children}</AuthCryptoProvider>;
}
