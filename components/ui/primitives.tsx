"use client";

import Link from "next/link";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { clsx } from "clsx";
import { formatMoney } from "@/lib/money";
import type { DisplayStatus } from "@/types";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={clsx("panel", className)}>{children}</section>;
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      type="button"
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors select-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-base",
        variant === "primary" && "bg-accent text-white hover:bg-[#d4572a]",
        variant === "secondary" && "border border-line bg-panel text-ink hover:bg-surface",
        variant === "ghost" && "text-ink hover:bg-surface",
        variant === "danger" && "bg-loss-soft text-loss hover:bg-loss hover:text-white",
        className,
      )}
    />
  );
}

/** Two-step inline confirmation for destructive actions. No modal. */
export function ConfirmButton({
  label,
  confirmLabel = "Confirm",
  onConfirm,
  size = "sm",
  disabled,
}: {
  label: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <Button variant="danger" size={size} disabled={disabled} onClick={() => setArmed(true)}>
        {label}
      </Button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Button variant="danger" size={size} onClick={() => { setArmed(false); onConfirm(); }}>
        {confirmLabel}
      </Button>
      <Button variant="ghost" size={size} onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </span>
  );
}

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="label mb-1.5 block">
      {children}
    </label>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-loss">
      {message}
    </p>
  );
}

const STATUS_STYLES: Record<DisplayStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-surface text-muted" },
  live: { label: "Live", className: "bg-accent-soft text-accent" },
  ready: { label: "Ready to settle", className: "bg-profit-soft text-profit" },
  settling: { label: "Settling", className: "bg-warn-soft text-warn" },
  settled: { label: "Settled", className: "bg-ink text-bg" },
  archived: { label: "Archived", className: "bg-surface text-muted line-through decoration-1" },
};

export function StatusPill({ status }: { status: DisplayStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em]",
        style.className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {style.label}
    </span>
  );
}

/** Money value coloured by sign: green = owed money, red = owes money, neutral = zero. */
export function SignedMoney({
  paise,
  currency = "INR",
  className,
}: {
  paise: number | null;
  currency?: string;
  className?: string;
}) {
  if (paise === null) {
    return <span className={clsx("num text-muted", className)}>—</span>;
  }
  const tone = paise > 0 ? "text-profit" : paise < 0 ? "text-loss" : "text-muted";
  return (
    <span className={clsx("num", tone, className)}>{formatMoney(paise, currency, { signed: true })}</span>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
  align = "left",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "profit" | "loss" | "accent";
  align?: "left" | "center";
}) {
  return (
    <Panel className={clsx("flex flex-col gap-2 p-4 sm:p-5", align === "center" && "items-center justify-center text-center")}>
      <span className="label">{label}</span>
      <span
        className={clsx(
          "num text-xl font-semibold sm:text-2xl",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
          tone === "accent" && "text-accent",
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </Panel>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Panel className="flex flex-col items-start gap-3 p-6 sm:p-8">
      <h2 className="font-mono text-base uppercase tracking-[0.08em]">{title}</h2>
      <p className="max-w-prose text-sm text-muted">{body}</p>
      {action}
    </Panel>
  );
}

export function PageHeading({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="label mb-1">{eyebrow}</p> : null}
        <h1 className="font-mono text-xl font-semibold uppercase tracking-[0.04em] sm:text-2xl">{title}</h1>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function NavLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
