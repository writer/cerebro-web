"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { useCerebroAgent } from "@/components/agent/CerebroAgentProvider";
import { useCommandPalette } from "@/components/providers";
import { LiveSearchCommand, useLiveSearchCommands } from "@/lib/live-search";
import { NavigationEntry, navigationEntries } from "@/lib/navigation";

type CommandSection = NavigationEntry["section"] | LiveSearchCommand["section"];

type Command = Omit<NavigationEntry, "section"> & {
  id: string;
  section: CommandSection;
  rank?: number;
  onRun?: () => void;
};

const commandText = (command: Command) =>
  [command.label, command.description, command.href, command.section, ...command.keywords].join(" ").toLowerCase();

const searchCommands = (query: string, askCerebro: (question: string) => void): Command[] => {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const encoded = encodeURIComponent(trimmed);
  return [
    { id: "ask-cerebro", label: `Ask Cerebro: "${trimmed}"`, href: `/ask?q=${encoded}`, description: "Send this question to the Cerebro agent.", section: "Operator", keywords: ["ask", "agent", "graph", "cypher"], onRun: () => askCerebro(trimmed) },
    { id: "search-risk-inbox", label: `Search Risk Inbox for "${trimmed}"`, href: `/risk-inbox?q=${encoded}`, description: "Filter findings by title, owner, entity, runtime, source, rule, or status.", section: "Operator", keywords: ["search", "findings", "risk"] },
    { id: "open-finding", label: `Open finding "${trimmed}"`, href: `/findings/${encoded}`, description: "Jump to a finding detail page by ID.", section: "Operator", keywords: ["finding", "detail"] },
    { id: "open-impact", label: `Open impact map for "${trimmed}"`, href: `/impact?root_urn=${encoded}`, description: "Use as entity URN or graph root.", section: "Operator", keywords: ["impact", "graph"] },
    { id: "search-controls", label: `Filter controls by "${trimmed}"`, href: `/controls?control=${encoded}`, description: "Find control IDs and mapped findings.", section: "Operator", keywords: ["controls", "framework"] },
    { id: "open-report", label: `Build audit packet for "${trimmed}"`, href: `/reports?finding_id=${encoded}`, description: "Use as a finding ID for an audit packet.", section: "Operator", keywords: ["reports", "audit"] },
    { id: "open-evidence", label: `Find evidence for "${trimmed}"`, href: `/evidence?finding_id=${encoded}`, description: "Use as a finding ID in the evidence register.", section: "Operator", keywords: ["evidence", "proof"] },
    { id: "open-connectors", label: `Filter connectors by "${trimmed}"`, href: `/connectors?runtime_ids=${encoded}`, description: "Use as source runtime IDs.", section: "Operator", keywords: ["connectors", "runtimes"] },
  ];
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
};

export default function CommandPalette() {
  const router = useRouter();
  const { openAgent } = useCerebroAgent();
  const { closeCommandPalette, isCommandPaletteOpen, openCommandPalette } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const liveSearch = useLiveSearchCommands(query, isCommandPaletteOpen);

  const askCerebro = useMemo(
    () => (question: string) => openAgent({ question, autoSubmit: true }),
    [openAgent],
  );

  const commands = useMemo<Command[]>(() => {
    const base = navigationEntries.map((e) => ({ ...e, id: `nav:${e.href}` }));
    const q = query.trim().toLowerCase();
    const filtered = q ? base.filter((c) => commandText(c).includes(q)) : base;
    return [...liveSearch.commands, ...searchCommands(query, askCerebro), ...filtered];
  }, [askCerebro, liveSearch.commands, query]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openCommandPalette();
      }
      if (event.key === "/" && !isEditableTarget(event.target)) {
        event.preventDefault();
        openCommandPalette();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openCommandPalette]);

  useEffect(() => {
    if (!isCommandPaletteOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const safeActiveIndex = Math.min(activeIndex, Math.max(commands.length - 1, 0));

  const dismiss = () => {
    closeCommandPalette();
    setQuery("");
    setActiveIndex(0);
  };

  const run = (c: Command) => {
    if (c.onRun) {
      c.onRun();
    } else {
      router.push(c.href);
    }
    dismiss();
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { dismiss(); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((i) => Math.min(i + 1, commands.length - 1)); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); return; }
    if (event.key === "Enter" && commands[safeActiveIndex]) { event.preventDefault(); run(commands[safeActiveIndex]); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 px-4 py-20 backdrop-blur-sm" onClick={dismiss}>
      <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-slate-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={onInputKeyDown}
            placeholder="Search findings, controls, evidence, connectors..."
            className="flex-1 border-0 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">ESC</kbd>
        </div>

        <div className="max-h-[28rem] overflow-y-auto p-1.5">
          {commands.length === 0 ? (
            <div className="flex items-center justify-center p-6 text-[13px] text-slate-500">No matching results.</div>
          ) : (
            commands.map((command, index) => (
              <button
                key={command.id}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => run(command)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                  index === safeActiveIndex ? "bg-indigo-50 text-indigo-900" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>
                  <span className="block text-[13px] font-medium">{command.label}</span>
                  <span className="mt-0.5 block text-[12px] text-slate-500">{command.description}</span>
                </span>
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  {command.section}
                </span>
              </button>
            ))
          )}
        </div>

        {query.trim().length >= 2 && (
          <div className="border-t border-slate-100 px-4 py-2 text-[12px] text-slate-500">
            {liveSearch.loading && "Searching live data..."}
            {!liveSearch.loading && liveSearch.error && `Live search unavailable: ${liveSearch.error}`}
            {!liveSearch.loading && !liveSearch.error && liveSearch.searched && `${liveSearch.commands.length} live result${liveSearch.commands.length === 1 ? "" : "s"}`}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400">
          <span>↑↓ navigate &middot; Enter to open &middot; Esc to close</span>
          <span>⌘K</span>
        </div>
      </div>
    </div>
  );
}
