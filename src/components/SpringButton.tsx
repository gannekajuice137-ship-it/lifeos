"use client";

import { type ButtonHTMLAttributes, type ReactNode, useRef } from "react";
import { motion, useSpring } from "motion/react";

interface SpringButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onPointerDown' | 'onPointerUp' | 'onPointerLeave' | 'onPointerCancel' | 'onDrag'> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: () => void;
  onPointerLeave?: () => void;
  onPointerCancel?: () => void;
}

export default function SpringButton({
  children,
  variant = "secondary",
  size = "md",
  className = "",
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  ...props
}: SpringButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Apple-style spring: critically damped (damping: 1.0), snappy response (0.3s)
  // Maps to Motion's bounce: 0 (no overshoot) + duration: 0.3
  const scale = useSpring(1, {
    bounce: 0,        // Critically damped - no overshoot (Apple principle #4)
    duration: 0.3,    // Response time in seconds
  });

  const variantClass = `btn-${variant}`;
  const sizeClass = size === "md" ? "" : `btn-${size}`;

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Instant response on pointer-down (Apple principle #1: Response)
    scale.set(0.96);
    onPointerDown?.(e);
  };

  const handlePointerUp = () => {
    // Spring back with natural physics
    scale.set(1);
    onPointerUp?.();
  };

  const handlePointerLeave = () => {
    scale.set(1);
    onPointerLeave?.();
  };

  const handlePointerCancel = () => {
    scale.set(1);
    onPointerCancel?.();
  };

  return (
    <motion.button
      ref={buttonRef}
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      style={{ scale }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerCancel}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}
