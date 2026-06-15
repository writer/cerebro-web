"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Circle, Clipboard, KeyRound, LockKeyhole, TerminalSquare } from "lucide-react";

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
  NormalizedCredentialStore,
} from "@/lib/connectors";
import {
  connectionMethodsForConnector,
  connectorSubmitErrorMessage,
  defaultCredentialStoreID,
  encryptConnectorCredentials,
} from "@/lib/connectors";

const labelClass = "text-[11px] font-semibold text-[var(--text-muted)]";
const inputClass = "control-input mt-1 w-full px-3 py-2 text-[13px]";

const readField = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const credentialInputName = (key: string) => `credential:${key}`;

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
    ["Preflight", "Validate first"],
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
  const selectedMethod = methods.find((method) => method.id === selectedMethodID) ?? preferredMethod;
  const methodStores = storesForMethod(selectedMethod, credentialStores);
  const visibleStores = methodStores.length > 0 ? methodStores : credentialStores;
  const [selectedStoreID, setSelectedStoreID] = useState<ConnectorCredentialStoreID>(() => defaultStoreForMethod(preferredMethod, credentialStores));
  const selectedStore = visibleStores.find((store) => store.id === selectedStoreID) ?? visibleStores[0];
  const selectedStoreIsValid = Boolean(selectedMethod && selectedStore && storeMatchesMethod(selectedStore, selectedMethod));
  const canSubmit = Boolean(selectedMethod && selectedStore?.available && selectedMethod.saveable !== false && selectedStoreIsValid);
  const anyStoreReady = credentialStores.some((store) => store.available);
  const [submitting, setSubmitting] = useState<"check" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ runtimeID: string; tenant: string; storeLabel: string; status: "checked" | "saved" } | null>(null);
  const defaultRuntimeID = [tenantID || "tenant", connector.source_id].filter(Boolean).join("-");

  useEffect(() => {
    if (!methods.some((method) => method.id === selectedMethodID) && preferredMethod) {
      setSelectedMethodID(preferredMethod.id);
    }
  }, [methods, preferredMethod, selectedMethodID]);

  useEffect(() => {
    const nextStoreID = defaultStoreForMethod(selectedMethod, credentialStores);
    const current = storesForMethod(selectedMethod, credentialStores).find((store) => store.id === selectedStoreID);
    if (!current) setSelectedStoreID(nextStoreID);
  }, [credentialStores, selectedMethod, selectedStoreID]);

  const changeMethod = (methodID: ConnectorConnectionMethodID) => {
    const nextMethod = methods.find((method) => method.id === methodID);
    setSelectedMethodID(methodID);
    setSelectedStoreID(defaultStoreForMethod(nextMethod, credentialStores));
    setError(null);
    setSuccess(null);
  };

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
        form.reset();
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
    <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void submitConnection(false); }} className="surface-panel overflow-hidden">
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

          <SetupStep index={1} title="Choose authentication method" icon={<KeyRound className="h-4 w-4" />}>
            <p className="mb-3 text-[12px] leading-5 text-[var(--text-muted)]">
              Available methods are advertised by the backend for this source. Unsupported methods are collapsed below.
            </p>
            <MethodTabs methods={methods} selectedID={selectedMethodID} onSelect={changeMethod} />
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
                <CredentialStoreSelector stores={visibleStores} selectedID={selectedStoreID} onSelect={setSelectedStoreID} compact />
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
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] bg-[var(--surface-muted)] px-5 py-4">
        <button type="button" onClick={() => formRef.current?.reset()} className="secondary-button px-3 py-2 text-[13px]">
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
