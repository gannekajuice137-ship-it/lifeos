"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface SpringButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export default function SpringButton({
  children,
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: SpringButtonProps) {
  const variantClass = `btn-${variant}`;
  const sizeClass = size === "md" ? "" : `btn-${size}`;

  return (
    <button
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      style={{
        transition: "transform 100ms ease-out, background 150ms ease",
      }}
      {...props}
    >
      {children}
    </button>
  );
}
