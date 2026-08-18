"use client";

import { usePathname } from "next/navigation";
import { useAuthCrypto } from "@/lib/context";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { isUnlocked, user, loading } = useAuthCrypto();
  const pathname = usePathname();
  const route = pathname.split("/")[1] || "tasks";

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
    return null; // UnlockScreen or LoginScreen will render instead
  }

  return (
    <div className="app-layout" data-route={route}>
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}
