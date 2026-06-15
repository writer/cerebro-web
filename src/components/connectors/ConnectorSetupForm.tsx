"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Circle, Clipboard, Database, KeyRound, ListChecks, LockKeyhole, Plus, RotateCcw, Search, ShieldCheck, TerminalSquare, X } from "lucide-react";

import CredentialStoreSelector from "@/components/connectors/CredentialStoreSelector";
import { Badge, ErrorBlock } from "@/components/grc/Primitives";
import { fetchCerebro } from "@/lib/cerebro-client";
import type {
  ConnectorCatalogEntry,
  ConnectorConnectionMethod,
  ConnectorConnectionMethodID,
  ConnectorCredentialKey,
  ConnectorCredentialStoreID,
  ConnectorField,
  ConnectorScopeOption,
  ConnectorScopeResource,
  NormalizedCredentialStore,
} from "@/lib/connectors";
import {
  connectionMethodsForConnector,
  connectorScopeOptionFamilies,
  connectorSubmitErrorMessage,
  defaultCredentialStoreID,
  encryptConnectorCredentials,
  normalizeScopePolicy,
  scopePolicyExclusionCount,
} from "@/lib/connectors";

const labelClass = "text-[11px] font-semibold text-[var(--text-muted)]";
const inputClass = "control-input mt-1 w-full px-3 py-2 text-[13px]";

const readField = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const credentialInputName = (key: string) => `credential:${key}`;
const splitScopeValues = (value: string) => value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);

function clearCredentialInputs(form: HTMLFormElement, fields: ConnectorField[]) {
  fields.forEach((field) => {
    const element = form.elements.namedItem(credentialInputName(field.key));
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.value = "";
    }
  });
}

function storeMatchesMethod(store: NormalizedCredentialStore, method: ConnectorConnectionMethod) {
  if (method.credential_stores?.includes(store.id)) return true;
  if (method.id === "encrypted_submission") return store.mode === "encrypted_submission";
  if (method.id === "external_reference") return store.mode === "reference";
  return store.mode === "environment_managed";
}

function storesForMethod(method: ConnectorConnectionMethod | undefined, stores: NormalizedCredentialStore[]) {
  if (!method) return stores;
  return stores.filter((store) => storeMatchesMethod(store, method));
}

function defaultStoreForMethod(method: ConnectorConnectionMethod | undefined, stores: NormalizedCredentialStore[]) {
  const methodStores = storesForMethod(method, stores);
  return defaultCredentialStoreID(methodStores.length > 0 ? methodStores : stores);
}

function MethodTabs({
  methods,
  selectedID,
  onSelect,
}: {
  methods: ConnectorConnectionMethod[];
  selectedID: ConnectorConnectionMethodID;
  onSelect: (id: ConnectorConnectionMethodID) => void;
}) {
  const availableMethods = methods.filter((method) => method.status !== "unavailable" && method.saveable !== false);
  const unavailableMethods = methods.filter((method) => method.status === "unavailable" || method.saveable === false);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {availableMethods.map((method) => {
          const active = method.id === selectedID;
          return (
            <button
              key={method.id}
              type="button"
              onClick={() => onSelect(method.id)}
              className={`min-h-[112px] rounded-lg border p-3 text-left transition ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] shadow-[var(--shadow-sm)]"
                  : "border-[color:var(--border)] bg-[var(--surface-raised)] hover:border-[color:var(--border-strong)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-[var(--text-primary)]">{method.shortLabel}</div>
                  <div className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">{method.label}</div>
                </div>
                {active ? <CheckCircle2 className="h-4 w-4 text-[var(--primary)]" /> : <Circle className="h-4 w-4 text-[var(--text-muted)]" />}
              </div>
              <div className="mt-3 text-[11px] leading-4 text-[var(--text-muted)]">{method.description}</div>
              <div className="mt-3">
                <Badge value={method.id === "encrypted_submission" ? "encrypted" : "backend backed"} />
              </div>
            </button>
          );
        })}
      </div>
      {unavailableMethods.length > 0 && (
        <details className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2">
          <summary className="cursor-pointer text-[12px] font-semibold text-[var(--text-secondary)]">
            {unavailableMethods.length} unavailable method{unavailableMethods.length === 1 ? "" : "s"}
          </summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {unavailableMethods.map((method) => (
              <div key={method.id} className="rounded-md border border-[color:var(--border)] bg-[var(--surface)] p-3 opacity-75">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-semibold text-[var(--text-primary)]">{method.shortLabel}</div>
                  <Badge value="blocked" />
                </div>
                <div className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">{method.disabledReason || method.unavailable_reason || method.label}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function SetupStep({
  index,
  title,
  icon,
  children,
}: {
  index: number;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-raised)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[12px] font-semibold text-[var(--primary)]">
          {index}
        </span>
        <span className="text-[var(--text-muted)]">{icon}</span>
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function StepRail({ methodLabel, storeLabel }: { methodLabel?: string; storeLabel?: string }) {
  const steps = [
    ["Method", methodLabel || "Choose auth"],
    ["Store", storeLabel || "Choose store"],
    ["Config", "Runtime metadata"],
    ["Scope", "Skip excluded assets"],
    ["Validate", "Test before saving"],
  ];
  return (
    <div className="hidden rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3 text-[12px] lg:block">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Connection flow</div>
      <ol className="space-y-3">
        {steps.map(([label, detail], index) => (
          <li key={label} className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[var(--surface)] text-[10px] font-semibold text-[var(--text-secondary)]">
              {index + 1}
            </span>
            <span>
              <span className="block font-semibold text-[var(--text-primary)]">{label}</span>
              <span className="block text-[11px] leading-4 text-[var(--text-muted)]">{detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CommandBlock({ commands }: { commands: string[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (commands.length === 0) return null;

  return (
    <div className="space-y-2">
      {commands.map((command) => (
        <div key={command} className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-zinc-950 px-3 py-2 text-zinc-100 dark:bg-black">
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12px]">{command}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(command).then(() => setCopied(command));
            }}
            className="secondary-button inline-flex shrink-0 items-center gap-1.5 px-2 py-1 text-[11px]"
          >
            <Clipboard className="h-3 w-3" />
            {copied === command ? "Copied" : "Copy"}
          </button>
        </div>
      ))}
    </div>
  );
}

function FieldGrid({
  fields,
  credential = false,
}: {
  fields: ConnectorField[];
  credential?: boolean;
}) {
  if (fields.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map((field) => (
        <label key={field.key} className={labelClass}>
          {field.label || field.key}{field.required ? " *" : ""}
          <input
            name={credential ? credentialInputName(field.key) : field.key}
            type={field.secret ? "password" : field.type ?? "text"}
            required={field.required}
            placeholder={field.placeholder}
            autoComplete={field.secret ? "new-password" : "off"}
            className={inputClass}
          />
          {field.help && <span className="mt-1 block text-[11px] font-normal leading-4 text-[var(--text-muted)]">{field.help}</span>}
        </label>
      ))}
    </div>
  );
}

function StoreReadinessChecklist({ stores }: { stores: NormalizedCredentialStore[] }) {
  const ready = stores.filter((store) => store.available);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
      <div className="text-[13px] font-semibold">No credential stores are ready</div>
      <div className="mt-2 text-[12px] leading-5">
        The backend must advertise at least one ready encrypted, reference-backed, or environment-managed store before a connection can be saved.
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {stores.map((store) => (
          <span key={store.id} className="rounded-md bg-white/70 px-2 py-1 text-[11px] font-semibold dark:bg-black/15">
            {store.label}: {store.available ? "ready" : store.disabledReason || "unavailable"}
          </span>
        ))}
        {ready.length === 0 && <span className="rounded-md bg-white/70 px-2 py-1 text-[11px] font-semibold dark:bg-black/15">waiting on backend</span>}
      </div>
    </div>
  );
}

function requirementCount(fields: ConnectorField[] | undefined) {
  return (fields ?? []).filter((field) => field.required).length;
}

function OnboardingBrief({
  method,
  store,
  basicsReady,
  fieldsReady,
  scopeCount,
}: {
  method?: ConnectorConnectionMethod;
  store?: NormalizedCredentialStore;
  basicsReady: boolean;
  fieldsReady: boolean;
  scopeCount: number;
}) {
  const configRequired = requirementCount(method?.config_fields);
  const credentialRequired = requirementCount(method?.credential_fields);
  const requiredFields = configRequired + credentialRequired;
  const requiresPreflight = (method?.commands?.length ?? 0) > 0;
  const sendsSecrets = method?.id === "encrypted_submission";
  const rows = [
    {
      label: "Method",
      detail: method ? `${method.shortLabel} selected` : "Choose a supported authentication method",
      ready: Boolean(method && method.status !== "unavailable" && method.saveable !== false),
    },
    {
      label: "Store",
      detail: store?.available ? `${store.label} is ready` : store?.disabledReason || "Choose a ready credential store",
      ready: Boolean(store?.available),
    },
    {
      label: "Basics",
      detail: basicsReady ? "Tenant and connection ID are set" : "Add tenant and connection ID",
      ready: basicsReady,
    },
    {
      label: "Preflight",
      detail: requiresPreflight ? "Run the CLI checks before testing" : "No CLI preflight required",
      ready: !requiresPreflight,
    },
    {
      label: "Fields",
      detail: requiredFields === 0 ? "No required fields" : fieldsReady ? "Required fields are filled" : `${configRequired} config and ${credentialRequired} credential/reference required below`,
      ready: fieldsReady,
    },
    {
      label: "Scope",
      detail: scopeCount > 0 ? `${scopeCount} exclusion${scopeCount === 1 ? "" : "s"} configured` : "All discovered resources are in scope",
      ready: true,
    },
  ];

  return (
    <div className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)]">
      <div>
        <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
          <ListChecks className="h-4 w-4 text-[var(--text-muted)]" />
          Onboarding checklist
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start gap-2 border-t border-[color:var(--border)] pt-2 first:border-t-0 first:pt-0 md:first:border-t md:first:pt-2">
              {row.ready ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />}
              <div>
                <div className="text-[12px] font-semibold text-[var(--text-primary)]">{row.label}</div>
                <div className="text-[11px] leading-4 text-[var(--text-muted)]">{row.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]">
          <ShieldCheck className="h-4 w-4 text-[var(--text-muted)]" />
          Credential boundary
        </div>
        <p className="mt-2 text-[12px] leading-5 text-[var(--text-muted)]">
          {sendsSecrets
            ? "Secret material is encrypted before submission, cleared after each attempt, and never returned by connector reads."
            : "This path stores only backend-resolvable references; paste references here, not secret values."}
        </p>
      </div>
    </div>
  );
}

type ResourceTypeFilter = "all" | "enabled" | "disabled" | "high_value";

function scopeOptionSearchText(option: ConnectorScopeOption, families: string[]) {
  return [option.label, option.id, option.type, option.support, ...families].filter(Boolean).join(" ").toLowerCase();
}

function ScopePolicyBuilder({
  connector,
  selectedFamilies,
  onDisableFamilies,
  onEnableFamilies,
  resourceURNs,
  onResourceURNsChange,
  resources,
  onResourcesChange,
}: {
  connector: ConnectorCatalogEntry;
  selectedFamilies: Set<string>;
  onDisableFamilies: (families: string[]) => void;
  onEnableFamilies: (families: string[]) => void;
  resourceURNs: string;
  onResourceURNsChange: (value: string) => void;
  resources: ConnectorScopeResource[];
  onResourcesChange: (resources: ConnectorScopeResource[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ResourceTypeFilter>("all");
  const [resourceType, setResourceType] = useState("");
  const [resourceID, setResourceID] = useState("");
  const [resourceReason, setResourceReason] = useState("");
  const options = useMemo(() => connector.scope_options ?? [], [connector.scope_options]);
  const rows = useMemo(() => options.map((option) => {
    const families = connectorScopeOptionFamilies(option);
    const disabled = families.some((family) => selectedFamilies.has(family));
    return {
      option,
      families,
      disabled,
      search: scopeOptionSearchText(option, families),
    };
  }), [options, selectedFamilies]);
  const disabledRows = rows.filter((row) => row.disabled);
  const enabledCount = Math.max(rows.length - disabledRows.length, 0);
  const selectedURNs = splitScopeValues(resourceURNs);
  const exactCount = selectedURNs.length + resources.length;
  const queryText = query.trim().toLowerCase();
  const visibleRows = rows.filter((row) => {
    const matchesQuery = queryText === "" || row.search.includes(queryText);
    const matchesFilter =
      filter === "all" ||
      (filter === "enabled" && !row.disabled) ||
      (filter === "disabled" && row.disabled) ||
      (filter === "high_value" && row.option.high_value);
    return matchesQuery && matchesFilter;
  });
  const shownRows = visibleRows.slice(0, 80);
  const allVisibleDisabled = shownRows.length > 0 && shownRows.every((row) => row.disabled);
  const visibleFamilies = shownRows.flatMap((row) => row.families);
  const exampleFamily = rows[0]?.families[0] ?? `${connector.source_id}.resource`;
  const exampleResourceType = exampleFamily.includes(".") || exampleFamily.startsWith(`${connector.source_id}_`)
    ? exampleFamily.replace(`${connector.source_id}_`, `${connector.source_id}.`)
    : `${connector.source_id}.${exampleFamily}`;
  const exampleResourceURN = `urn:cerebro:tenant:${exampleResourceType.replaceAll(".", "_")}:example`;
  const addResource = () => {
    const type = resourceType.trim();
    const id = resourceID.trim();
    if (!type || !id) return;
    onResourcesChange([...resources, { type, id, reason: resourceReason.trim() || undefined }]);
    setResourceType("");
    setResourceID("");
    setResourceReason("");
  };
  const filters: Array<{ id: ResourceTypeFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: rows.length },
    { id: "enabled", label: "Collecting", count: enabledCount },
    { id: "disabled", label: "Skipped", count: disabledRows.length },
    { id: "high_value", label: "High value", count: rows.filter((row) => row.option.high_value).length },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[var(--surface)]">
        <div className="grid gap-3 border-b border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">Resource collection</div>
            <div className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
              Resource types are collected by default. Switch a type off to skip that source family before collection; exact assets can be added separately.
            </div>
          </div>
          <div className="grid grid-cols-3 overflow-hidden rounded-md border border-[color:var(--border)] bg-[var(--surface)] text-center text-[11px]">
            <div className="px-3 py-2">
              <div className="text-[15px] font-semibold text-[var(--text-primary)]">{rows.length}</div>
              <div className="text-[var(--text-muted)]">Available</div>
            </div>
            <div className="border-l border-[color:var(--border)] px-3 py-2">
              <div className="text-[15px] font-semibold text-emerald-600">{enabledCount}</div>
              <div className="text-[var(--text-muted)]">On</div>
            </div>
            <div className="border-l border-[color:var(--border)] px-3 py-2">
              <div className="text-[15px] font-semibold text-amber-600">{disabledRows.length}</div>
              <div className="text-[var(--text-muted)]">Off</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--border)] px-4 py-3">
          <label className="relative min-w-[240px] flex-1">
            <span className="sr-only">Search resource types</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search resource types..." className="control-input w-full px-9 py-2 text-[13px]" />
          </label>
          <div className="flex flex-wrap gap-1 rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] p-1">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded px-2.5 py-1.5 text-[12px] font-semibold transition ${
                  filter === item.id
                    ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {item.label} <span className="font-mono text-[11px] opacity-70">{item.count}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => (allVisibleDisabled ? onEnableFamilies(visibleFamilies) : onDisableFamilies(visibleFamilies))}
            disabled={shownRows.length === 0}
            className="secondary-button inline-flex items-center gap-2 px-3 py-2 text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {allVisibleDisabled ? "Enable visible" : "Disable visible"}
          </button>
        </div>

        <div className="max-h-[430px] overflow-y-auto">
          {shownRows.map(({ option, families, disabled }) => (
            <div
              key={`${option.id}:${families.join(",")}`}
              className={`grid gap-3 border-b border-[color:var(--border)] px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto] ${
                disabled ? "bg-amber-50/60 dark:bg-amber-500/10" : "bg-[var(--surface)]"
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[13px] font-semibold text-[var(--text-primary)]">{option.label || option.id}</div>
                  {option.high_value && <Badge value="high value" />}
                  {option.support && <Badge value={option.support} />}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {families.map((family) => (
                    <span key={family} className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                      {family}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 md:justify-end">
                <span className={`text-[12px] font-semibold ${disabled ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                  {disabled ? "Skipped" : "Collecting"}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!disabled}
                  aria-label={`${disabled ? "Enable" : "Disable"} ${option.label || option.id}`}
                  onClick={() => (disabled ? onEnableFamilies(families) : onDisableFamilies(families))}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${
                    disabled
                      ? "border-amber-300 bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/20"
                      : "border-emerald-300 bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/20"
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-white shadow-sm transition dark:bg-zinc-100 ${
                      disabled ? "translate-x-0.5" : "translate-x-5"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
          {shownRows.length === 0 && (
            <div className="p-6 text-center text-[13px] text-[var(--text-muted)]">
              {rows.length === 0 ? "This connector has not advertised resource types yet." : "No resource types match the current search and filter."}
            </div>
          )}
        </div>
        {visibleRows.length > shownRows.length && (
          <div className="border-t border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-[12px] text-[var(--text-muted)]">
            Showing {shownRows.length} of {visibleRows.length} matching resource types. Narrow the search to edit the rest.
          </div>
        )}
      </div>

      <details className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4" open={exactCount > 0}>
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">Specific asset exclusions</div>
              <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                Use only when a single known asset should be skipped while its resource type stays enabled.
              </div>
            </div>
            <Badge value={exactCount > 0 ? `${exactCount} exact` : "optional"} />
          </div>
        </summary>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.75fr)]">
          <label className="text-[11px] font-semibold text-[var(--text-muted)]">
            Exact resource URNs
            <textarea
              value={resourceURNs}
              onChange={(event) => onResourceURNsChange(event.target.value)}
              placeholder={exampleResourceURN}
              className="control-input mt-1 min-h-[112px] w-full px-3 py-2 font-mono text-[12px]"
            />
            <span className="mt-1 block text-[11px] font-normal leading-4 text-[var(--text-muted)]">One URN per line or comma-separated.</span>
          </label>
          <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">Typed resource ID</div>
            <div className="mt-3 grid gap-2">
              <input value={resourceType} onChange={(event) => setResourceType(event.target.value)} placeholder={exampleResourceType} className="control-input px-3 py-2 text-[13px]" />
              <input value={resourceID} onChange={(event) => setResourceID(event.target.value)} placeholder="resource-id" className="control-input px-3 py-2 text-[13px]" />
              <input value={resourceReason} onChange={(event) => setResourceReason(event.target.value)} placeholder="Reason, optional" className="control-input px-3 py-2 text-[13px]" />
              <button type="button" onClick={addResource} disabled={!resourceType.trim() || !resourceID.trim()} className="secondary-button inline-flex items-center justify-center gap-2 px-3 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-50">
                <Plus className="h-4 w-4" />
                Add resource
              </button>
            </div>
          </div>
        </div>

        {exactCount > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedURNs.slice(0, 8).map((urn) => (
              <span key={urn} className="inline-flex max-w-full items-center gap-2 rounded-md bg-[var(--surface-muted)] px-2 py-1 font-mono text-[11px] text-[var(--text-secondary)]">
                <span className="truncate">{urn}</span>
                <button
                  type="button"
                  onClick={() => onResourceURNsChange(selectedURNs.filter((item) => item !== urn).join("\n"))}
                  className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  aria-label={`Remove ${urn}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {selectedURNs.length > 8 && (
              <span className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-[12px] font-semibold text-[var(--text-muted)]">
                +{selectedURNs.length - 8} URNs
              </span>
            )}
            {resources.map((resource, index) => (
              <span key={`${resource.type}:${resource.id}:${index}`} className="inline-flex items-center gap-2 rounded-md bg-[var(--surface-muted)] px-2 py-1 text-[12px] font-semibold text-[var(--text-secondary)]">
                {resource.type}:{resource.id}
                <button type="button" onClick={() => onResourcesChange(resources.filter((_, itemIndex) => itemIndex !== index))} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label={`Remove ${resource.type}:${resource.id}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </details>
    </div>
  );
}

export default function ConnectorSetupForm({
  connector,
  tenantID,
  apiKey,
  credentialStores,
  onConnected,
}: {
  connector: ConnectorCatalogEntry;
  tenantID: string;
  apiKey?: string;
  credentialStores: NormalizedCredentialStore[];
  onConnected: () => Promise<void> | void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const methods = useMemo(() => connectionMethodsForConnector(connector, credentialStores), [connector, credentialStores]);
  const preferredMethod = methods.find((method) => method.status !== "unavailable" && method.saveable !== false) ?? methods[0];
  const [selectedMethodID, setSelectedMethodID] = useState<ConnectorConnectionMethodID>(preferredMethod?.id ?? "encrypted_submission");
  const effectiveSelectedMethodID = methods.some((method) => method.id === selectedMethodID)
    ? selectedMethodID
    : preferredMethod?.id;
  const selectedMethod = methods.find((method) => method.id === effectiveSelectedMethodID) ?? preferredMethod;
  const methodStores = storesForMethod(selectedMethod, credentialStores);
  const visibleStores = methodStores.length > 0 ? methodStores : credentialStores;
  const [selectedStoreID, setSelectedStoreID] = useState<ConnectorCredentialStoreID>(() => defaultStoreForMethod(preferredMethod, credentialStores));
  const defaultSelectedStoreID = defaultStoreForMethod(selectedMethod, credentialStores);
  const selectedStore = visibleStores.find((store) => store.id === selectedStoreID)
    ?? visibleStores.find((store) => store.id === defaultSelectedStoreID)
    ?? visibleStores[0];
  const effectiveSelectedStoreID = selectedStore?.id ?? defaultSelectedStoreID;
  const selectedStoreIsValid = Boolean(selectedMethod && selectedStore && storeMatchesMethod(selectedStore, selectedMethod));
  const canSubmit = Boolean(selectedMethod && selectedStore?.available && selectedMethod.saveable !== false && selectedStoreIsValid);
  const anyStoreReady = credentialStores.some((store) => store.available);
  const [submitting, setSubmitting] = useState<"check" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ runtimeID: string; tenant: string; storeLabel: string; status: "checked" | "saved" } | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [excludedFamilies, setExcludedFamilies] = useState<Set<string>>(() => new Set());
  const [resourceURNs, setResourceURNs] = useState("");
  const [excludedResources, setExcludedResources] = useState<ConnectorScopeResource[]>([]);
  const defaultRuntimeID = [tenantID, connector.source_id, "connection"].filter(Boolean).join("-") || `${connector.source_id}-connection`;
  const updateFormValues = () => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const values: Record<string, string> = {};
    data.forEach((value, key) => {
      values[key] = String(value).trim();
    });
    setFormValues(values);
  };
  const requiredFieldKeys = useMemo(() => {
    if (!selectedMethod) return [];
    return [
      ...(selectedMethod.config_fields ?? []).filter((field) => field.required).map((field) => field.key),
      ...(selectedMethod.credential_fields ?? []).filter((field) => field.required).map((field) => credentialInputName(field.key)),
    ];
  }, [selectedMethod]);
  const basicsReady = Boolean(formValues.tenant_id && formValues.runtime_id);
  const requiredFieldsReady = requiredFieldKeys.length === 0 || requiredFieldKeys.every((key) => Boolean(formValues[key]));
  const scopePolicy = useMemo(() => normalizeScopePolicy({
    excluded_families: Array.from(excludedFamilies),
    excluded_resource_urns: splitScopeValues(resourceURNs),
    excluded_resources: excludedResources,
  }), [excludedFamilies, excludedResources, resourceURNs]);
  const scopeCount = scopePolicyExclusionCount(scopePolicy);

  const changeMethod = (methodID: ConnectorConnectionMethodID) => {
    const nextMethod = methods.find((method) => method.id === methodID);
    setSelectedMethodID(methodID);
    setSelectedStoreID(defaultStoreForMethod(nextMethod, credentialStores));
    setError(null);
    setSuccess(null);
  };

  const updateScopeFamilies = (families: string[], disabled: boolean) => {
    setExcludedFamilies((previous) => {
      const next = new Set(previous);
      const normalized = families.map((family) => family.trim().toLowerCase()).filter(Boolean);
      normalized.forEach((family) => {
        if (disabled) next.add(family);
        else next.delete(family);
      });
      return next;
    });
  };

  const resetForm = () => {
    formRef.current?.reset();
    setExcludedFamilies(new Set());
    setResourceURNs("");
    setExcludedResources([]);
    window.setTimeout(updateFormValues, 0);
  };

  useEffect(() => {
    const timer = window.setTimeout(updateFormValues, 0);
    return () => window.clearTimeout(timer);
  }, [effectiveSelectedMethodID, effectiveSelectedStoreID, tenantID]);

  const submitConnection = async (checkOnly: boolean) => {
    const form = formRef.current;
    if (!form || !selectedMethod || !selectedStore) return;
    if (!form.reportValidity()) return;
    if (!canSubmit) {
      setError(selectedMethod.disabledReason || "Selected auth method or credential store is not available.");
      return;
    }

    setSubmitting(checkOnly ? "check" : "save");
    setError(null);
    setSuccess(null);
    const formData = new FormData(form);
    const runtimeID = readField(formData, "runtime_id");
    const tenant = readField(formData, "tenant_id");
    const config: Record<string, string> = {};
    const credentials: Record<string, string> = {};
    const credentialReferences: Record<string, string> = {};
    const credentialFields = selectedMethod.credential_fields ?? [];

    try {
      (selectedMethod.config_fields ?? []).forEach((field) => {
        const value = readField(formData, field.key);
        if (value) config[field.key] = value;
      });

      credentialFields.forEach((field) => {
        const value = readField(formData, credentialInputName(field.key));
        if (!value) return;
        if (selectedMethod.id === "encrypted_submission") {
          credentials[field.key] = value;
        } else {
          credentialReferences[field.key] = value;
        }
      });

      const body: Record<string, unknown> = {
        runtime_id: runtimeID,
        tenant_id: tenant,
        check_only: checkOnly,
        auth_method: selectedMethod.id,
        credential_store_id: selectedStore.id,
        config,
      };
      if (scopePolicy) {
        body.scope_policy = scopePolicy;
      }

      if (selectedMethod.id === "encrypted_submission") {
        const keyResponse = await fetchCerebro<ConnectorCredentialKey>("/connectors/credential-key", apiKey);
        if (!keyResponse.ok) throw new Error(connectorSubmitErrorMessage(keyResponse.status));
        body.encrypted_credentials = await encryptConnectorCredentials(keyResponse.data, credentials, {
          sourceID: connector.source_id,
          tenantID: tenant,
          runtimeID,
          credentialStoreID: selectedStore.id,
        });
      } else if (Object.keys(credentialReferences).length > 0) {
        body.credential_references = credentialReferences;
      }

      const response = await fetchCerebro(`/connectors/${encodeURIComponent(connector.source_id)}/connections`, apiKey, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(connectorSubmitErrorMessage(response.status));
      setSuccess({ runtimeID, tenant, storeLabel: selectedStore.label, status: checkOnly ? "checked" : "saved" });
      if (!checkOnly) {
        resetForm();
        await onConnected();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : connectorSubmitErrorMessage());
    } finally {
      Object.keys(credentials).forEach((key) => {
        credentials[key] = "";
      });
      clearCredentialInputs(form, credentialFields);
      setSubmitting(null);
    }
  };

  return (
    <form
      ref={formRef}
      onInput={updateFormValues}
      onReset={() => window.setTimeout(updateFormValues, 0)}
      onSubmit={(event) => { event.preventDefault(); void submitConnection(false); }}
      className="surface-panel overflow-hidden"
    >
      <div className="border-b border-[color:var(--border)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Add connection</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[var(--text-muted)]">
              Choose the authentication path, select where credentials live, validate access, then save the runtime.
            </p>
          </div>
          {selectedMethod && <Badge value={selectedMethod.shortLabel} />}
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[180px_minmax(0,1fr)]">
        <StepRail methodLabel={selectedMethod?.shortLabel} storeLabel={selectedStore?.label} />
        <div className="space-y-4">
          {!anyStoreReady && <StoreReadinessChecklist stores={credentialStores} />}
          {error && <ErrorBlock error={error} />}
          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-[13px] text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100">
              <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> Connection {success.status}</div>
              <div className="mt-1 text-[12px] leading-5">
                {success.runtimeID} for {success.tenant || "default tenant"} using {success.storeLabel}.
              </div>
            </div>
          )}
          <OnboardingBrief method={selectedMethod} store={selectedStore} basicsReady={basicsReady} fieldsReady={requiredFieldsReady} scopeCount={scopeCount} />

          <SetupStep index={1} title="Choose authentication method" icon={<KeyRound className="h-4 w-4" />}>
            <p className="mb-3 text-[12px] leading-5 text-[var(--text-muted)]">
              Available methods are advertised by the backend for this source. Unsupported methods are collapsed below.
            </p>
            <MethodTabs methods={methods} selectedID={effectiveSelectedMethodID ?? "encrypted_submission"} onSelect={changeMethod} />
          </SetupStep>

          <SetupStep index={2} title="Choose credential store" icon={<LockKeyhole className="h-4 w-4" />}>
            {selectedMethod && (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="max-w-2xl text-[12px] leading-5 text-[var(--text-muted)]">{selectedMethod.description}</p>
                  <span className="rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[12px] font-semibold text-[var(--text-secondary)]">
                    {selectedStore?.available ? selectedStore.label : "No ready store"}
                  </span>
                </div>
                <CredentialStoreSelector stores={visibleStores} selectedID={effectiveSelectedStoreID} onSelect={setSelectedStoreID} compact />
              </>
            )}
          </SetupStep>

          <SetupStep index={3} title="Configure runtime" icon={<TerminalSquare className="h-4 w-4" />}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelClass}>
                Tenant
                <input name="tenant_id" defaultValue={tenantID} required placeholder="tenant" className={inputClass} />
              </label>
              <label className={labelClass}>
                Connection ID
                <input name="runtime_id" defaultValue={defaultRuntimeID} required placeholder="tenant-source" className={inputClass} />
              </label>
            </div>

            {selectedMethod?.commands && selectedMethod.commands.length > 0 && (
              <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4">
                <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
                  <TerminalSquare className="h-4 w-4 text-[var(--text-muted)]" />
                  CLI preflight
                </div>
                <CommandBlock commands={selectedMethod.commands} />
              </div>
            )}

            {selectedMethod && (selectedMethod.config_fields?.length ?? 0) > 0 && (
              <div className="mt-4">
                <div className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Configuration</div>
                <FieldGrid fields={selectedMethod.config_fields ?? []} />
              </div>
            )}

            {selectedMethod && (selectedMethod.credential_fields?.length ?? 0) > 0 && (
              <div className="mt-4">
                <div className="mb-3">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
                    {selectedMethod.id === "encrypted_submission" ? <LockKeyhole className="h-4 w-4 text-[var(--text-muted)]" /> : <AlertCircle className="h-4 w-4 text-[var(--text-muted)]" />}
                    {selectedMethod.id === "encrypted_submission" ? "Credential material" : "Credential references"}
                  </div>
                  <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                    {selectedMethod.id === "encrypted_submission"
                      ? "Values are encrypted before submission and cleared after every attempt."
                      : "Enter server-resolvable references only; do not enter secret values."}
                  </div>
                </div>
                <FieldGrid fields={selectedMethod.credential_fields ?? []} credential />
              </div>
            )}
          </SetupStep>

          <SetupStep index={4} title="Set resource scope" icon={<Database className="h-4 w-4" />}>
            <ScopePolicyBuilder
              connector={connector}
              selectedFamilies={excludedFamilies}
              onDisableFamilies={(families) => updateScopeFamilies(families, true)}
              onEnableFamilies={(families) => updateScopeFamilies(families, false)}
              resourceURNs={resourceURNs}
              onResourceURNsChange={setResourceURNs}
              resources={excludedResources}
              onResourcesChange={setExcludedResources}
            />
          </SetupStep>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] bg-[var(--surface-muted)] px-5 py-4">
        <button type="button" onClick={resetForm} className="secondary-button px-3 py-2 text-[13px]">
          Reset
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canSubmit || submitting !== null}
            onClick={() => void submitConnection(true)}
            className="secondary-button px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {submitting === "check" ? "Testing..." : "Test connection"}
          </button>
          <button type="submit" disabled={!canSubmit || submitting !== null} className="primary-button px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-55">
            {submitting === "save" ? "Saving..." : "Save connection"}
          </button>
        </div>
      </div>
    </form>
  );
}
