"use client";

import { type FormEvent, type KeyboardEvent, useState } from "react";

import { askModelOptions, defaultAskModel } from "@/lib/ask";

type Props = {
  onSubmit: (input: { question: string; model: string; tenantId: string; scopeUrn: string }) => void;
  disabled?: boolean;
  initialScopeUrn?: string;
};

export default function AskInput({
  onSubmit,
  disabled = false,
  initialScopeUrn = "",
}: Props) {
  const [question, setQuestion] = useState("");
  const [model, setModel] = useState(defaultAskModel);
  const [tenantId, setTenantId] = useState("");
  const [scopeUrn, setScopeUrn] = useState(initialScopeUrn);
  const [lastSeed, setLastSeed] = useState(initialScopeUrn);
  if (initialScopeUrn !== lastSeed) {
    setLastSeed(initialScopeUrn);
    setScopeUrn(initialScopeUrn);
  }

  const submit = () => {
    const trimmed = question.trim();
    if (!trimmed || disabled) return;
    onSubmit({ question: trimmed, model, tenantId: tenantId.trim(), scopeUrn: scopeUrn.trim() });
    setQuestion("");
  };

  const onFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={onFormSubmit} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Ask graph</div>
          <p className="mt-1 text-[13px] text-slate-500">
            Best results come from a concrete entity, relationship, or finding question. Scope narrows graph access when provided.
          </p>
        </div>
        {disabled && (
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
            Generating
          </span>
        )}
      </div>
      <textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        disabled={disabled}
        placeholder="Ask about the graph. e.g. Which okta users have more than one github account?"
        className="mt-3 w-full resize-none border-0 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Tenant</span>
            <input
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              placeholder="writer"
              disabled={disabled}
              className="w-32 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 disabled:opacity-60"
            />
          </label>
          <label className="flex items-center gap-2 text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Scope URN</span>
            <input
              value={scopeUrn}
              onChange={(event) => setScopeUrn(event.target.value)}
              placeholder="urn:cerebro:..."
              disabled={disabled}
              className="w-72 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 disabled:opacity-60"
            />
          </label>
          <label className="flex items-center gap-2 text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Model</span>
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              disabled={disabled}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-900 disabled:opacity-60"
            >
              {askModelOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} — {option.hint}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400">{disabled ? "Use Stop on the active turn to cancel" : "⌘+Enter to send"}</span>
          <button
            type="submit"
            disabled={disabled || !question.trim()}
            className="rounded-md bg-indigo-500 px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      </div>
    </form>
  );
}
