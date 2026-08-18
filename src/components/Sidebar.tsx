"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthCrypto } from "@/lib/context";
import {
  TasksIcon,
  CfIcon,
  NotesIcon,
  WikiIcon,
  PeopleIcon,
  LockIcon,
  SunIcon,
  MoonIcon,
  AtomIcon,
} from "./icons";
import type { CSSProperties } from "react";

const NAV_ITEMS = [
  { href: "/tasks", label: "Tasks", icon: TasksIcon, accent: "var(--accent-tasks)" },
  { href: "/cf", label: "Codeforces", icon: CfIcon, accent: "var(--accent-cf)" },
  { href: "/notes", label: "Notes", icon: NotesIcon, accent: "var(--accent-notes)" },
  { href: "/wiki", label: "Wiki", icon: WikiIcon, accent: "var(--accent-wiki)" },
  { href: "/people", label: "People", icon: PeopleIcon, accent: "var(--accent-people)" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { lock } = useAuthCrypto();

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  const isDark =
    typeof window !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "dark";

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-mark">
          <AtomIcon />
        </span>
        LifeOS
      </div>

      <div className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive ? "active" : ""}`}
              style={{ "--nav-accent": item.accent } as CSSProperties}
            >
              <Icon className="icon" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-footer">
        <button
          className="sidebar-link"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {isDark ? (
            <SunIcon className="icon" />
          ) : (
            <MoonIcon className="icon" />
          )}
          Theme
        </button>

        <button className="sidebar-link" onClick={lock} aria-label="Lock app">
          <LockIcon className="icon" />
          Lock
        </button>
      </div>
    </nav>
  );
}
