"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthCrypto } from "@/lib/context";
import UnlockScreen from "@/components/UnlockScreen";

export default function HomePage() {
  const { isUnlocked, user, loading } = useAuthCrypto();
  const router = useRouter();

  useEffect(() => {
    if (isUnlocked && user) {
      router.replace("/tasks");
    }
  }, [isUnlocked, user, router]);

  if (loading) {
    return (
      <div className="unlock-screen">
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          Loading...
        </div>
      </div>
    );
  }

  if (isUnlocked && user) {
    return (
      <div className="unlock-screen">
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          Redirecting...
        </div>
      </div>
    );
  }

  return <UnlockScreen />;
}
