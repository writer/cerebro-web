"use client";

import Link from "next/link";

type Props = {
  question: string;
  scopeUrn?: string;
  variant?: "link" | "button";
  className?: string;
  title?: string;
  children?: React.ReactNode;
};

const baseLink =
  "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700 hover:text-indigo-900";

const baseButton =
  "inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-100";

export default function AskAboutLink({
  question,
  scopeUrn,
  variant = "link",
  className,
  title,
  children,
}: Props) {
  const params = new URLSearchParams({ q: question });
  if (scopeUrn) params.set("scope_urn", scopeUrn);
  const href = `/ask?${params.toString()}`;
  const cls =
    className ?? (variant === "button" ? baseButton : baseLink);
  return (
    <Link href={href} className={cls} title={title ?? question} prefetch={false}>
      {children ?? "Ask about this"}
    </Link>
  );
}
