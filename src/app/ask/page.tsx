"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useApiKey } from "@/components/providers";
import { PageHeader } from "@/components/grc/Primitives";
import AskInput from "@/components/ask/AskInput";
import AskThread from "@/components/ask/AskThread";
import {
  type AskHistoryEntry,
  type AskRequest,
  type AskTurnState,
  askEmptyState,
  defaultAskModel,
  markAskTurnAborted,
  normalizeAskModel,
  reduceAskEvent,
  streamAsk,
} from "@/lib/ask";

const sampleQuestions = [
  "How many findings are there per source family, top 10?",
  "Which github.user URNs are linked to more than one okta.user via identity.email?",
  "Show the top 10 internet.host entities by incoming edges from aws.* sources.",
];

function AskPageInner() {
  const { apiKey } = useApiKey();
  const searchParams = useSearchParams();
  const [turns, setTurns] = useState<AskTurnState[]>([]);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoFiredRef = useRef(false);

  const seededQuestion = searchParams.get("q") ?? "";
  const seededScope = searchParams.get("scope_urn") ?? "";
  const seededModel = searchParams.get("model") ?? "";
  const seededTenant = searchParams.get("tenant_id") ?? "";

  const history = useMemo<AskHistoryEntry[]>(
    () =>
      turns.flatMap((turn) => {
        const entries: AskHistoryEntry[] = [{ role: "user", content: turn.question }];
        if (turn.summary?.markdown) {
          entries.push({ role: "assistant", content: turn.summary.markdown });
        }
        return entries;
      }),
    [turns],
  );

  const stopActiveTurn = useCallback(() => {
    const activeID = activeTurnId;
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveTurnId(null);
    if (activeID) {
      setTurns((prev) => prev.map((turn) => (turn.id === activeID ? markAskTurnAborted(turn) : turn)));
    }
  }, [activeTurnId]);

  const runAsk = useCallback(
    async (input: { question: string; model: string; tenantId: string; scopeUrn: string }) => {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      const turnId = typeof crypto !== "undefined" ? crypto.randomUUID() : `t-${Date.now()}`;
      const model = normalizeAskModel(input.model);
      const tenantId = input.tenantId || "writer";
      const initial = askEmptyState({
        id: turnId,
        question: input.question,
        startedAt: Date.now(),
        updatedAt: Date.now(),
        model,
        tenantId,
        scopeUrn: input.scopeUrn || undefined,
      });
      setTurns((prev) => [...prev, initial]);
      setActiveTurnId(turnId);
      const request: AskRequest = {
        tenant_id: tenantId,
        question: input.question,
        scope_urn: input.scopeUrn || undefined,
        model,
        history,
      };
      try {
        for await (const event of streamAsk(request, apiKey, controller.signal)) {
          setTurns((prev) =>
            prev.map((turn) => (turn.id === turnId ? reduceAskEvent(turn, event) : turn)),
          );
          if (event.type === "done" || event.type === "error") {
            setActiveTurnId(null);
          }
        }
      } catch (error) {
        if (controller.signal.aborted) {
          setActiveTurnId(null);
          setTurns((prev) => prev.map((turn) => (turn.id === turnId ? markAskTurnAborted(turn) : turn)));
          return;
        }
        setTurns((prev) =>
          prev.map((turn) =>
            turn.id === turnId
              ? {
                  ...turn,
                  status: "error",
                  updatedAt: Date.now(),
                  error: {
                    code: "client_exception",
                    message: error instanceof Error ? error.message : "Ask stream failed",
                  },
                }
              : turn,
          ),
        );
        setActiveTurnId(null);
      }
    },
    [apiKey, history],
  );

  const retryTurn = useCallback(
    (turn: AskTurnState) => {
      void runAsk({
        question: turn.question,
        model: normalizeAskModel(turn.model),
        tenantId: turn.tenantId ?? "writer",
        scopeUrn: turn.scopeUrn ?? "",
      });
    },
    [runAsk],
  );

  useEffect(() => {
    if (autoFiredRef.current) return;
    if (!seededQuestion.trim()) return;
    autoFiredRef.current = true;
    void runAsk({
      question: seededQuestion.trim(),
      model: seededModel || defaultAskModel,
      tenantId: seededTenant,
      scopeUrn: seededScope,
    });
  }, [runAsk, seededModel, seededQuestion, seededScope, seededTenant]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ask Cerebro"
        description="Natural-language questions against the graph. The model drafts Cypher, a validator checks it, Neo4j runs it, and you get cited results back."
        action={
          turns.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {activeTurnId && (
                <button
                  type="button"
                  onClick={stopActiveTurn}
                  className="rounded-md border border-rose-200 px-3 py-1.5 text-[13px] font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                >
                  Stop
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  abortRef.current?.abort();
                  setTurns([]);
                  setActiveTurnId(null);
                }}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300"
              >
                Clear thread
              </button>
            </div>
          ) : undefined
        }
      />

      <AskInput
        onSubmit={runAsk}
        disabled={Boolean(activeTurnId)}
        initialScopeUrn={seededScope}
      />

      {turns.length === 0 && (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Try one</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {sampleQuestions.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() =>
                  void runAsk({ question: sample, model: "claude-sonnet-4-6", tenantId: "", scopeUrn: "" })
                }
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[13px] text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
              >
                {sample}
              </button>
            ))}
          </div>
        </section>
      )}

      <AskThread turns={turns} activeTurnId={activeTurnId} onRetry={retryTurn} onStop={stopActiveTurn} />
    </div>
  );
}

export default function AskPage() {
  return (
    <Suspense fallback={null}>
      <AskPageInner />
    </Suspense>
  );
}
