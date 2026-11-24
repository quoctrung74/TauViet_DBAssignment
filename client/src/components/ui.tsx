import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "dark" }) {
  const styles = {
    primary:
      "bg-signal text-white hover:bg-signal-dark shadow-[0_8px_20px_-8px_rgb(210_69_42/0.7)] disabled:shadow-none",
    dark: "bg-ink text-paper hover:bg-ink-soft",
    ghost: "text-ink hover:bg-ink/5 border border-line",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 h-12 text-[15px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${styles} ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl bg-card border border-line shadow-[0_1px_0_rgb(17_38_31/0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="mb-6">
      <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-signal mb-2">
        {eyebrow}
      </div>
      <h2 className="text-2xl md:text-[28px] font-bold tracking-tight leading-tight">{title}</h2>
      {desc && <p className="text-muted mt-1.5 text-[15px]">{desc}</p>}
    </div>
  );
}

export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-ink-soft mb-1.5">{label}</span>
      {children}
      {error ? (
        <span className="block text-[12px] text-signal mt-1">{error}</span>
      ) : hint ? (
        <span className="block text-[12px] text-muted mt-1">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputCls = (error?: boolean) =>
  `w-full h-12 rounded-xl border bg-white px-4 text-[15px] outline-none transition placeholder:text-muted/60 focus:ring-4 ${
    error ? "border-signal focus:ring-signal/15" : "border-line focus:border-ink focus:ring-ink/10"
  }`;
