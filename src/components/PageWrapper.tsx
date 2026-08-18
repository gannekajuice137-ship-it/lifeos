"use client";

import { useAuthCrypto } from "@/lib/context";
import UnlockScreen from "./UnlockScreen";

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const { isUnlocked, user, loading } = useAuthCrypto();

  if (loading) {
    return (
      <div className="unlock-screen">
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!isUnlocked || !user) {
    return <UnlockScreen />;
  }

  return <>{children}</>;
}
