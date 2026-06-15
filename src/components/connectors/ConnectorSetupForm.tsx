"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
      {methods.map((method) => {
        const active = method.id === selectedID;
        const unavailable = method.status === "unavailable" || method.saveable === false;
        return (
          <button
            key={method.id}
            type="button"
            onClick={() => onSelect(method.id)}
            className={`min-h-[96px] rounded-lg border p-3 text-left transition ${
              active
                ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                : "border-[color:var(--border)] bg-[var(--surface-raised)] hover:border-[color:var(--border-strong)]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">{method.shortLabel}</div>
              <span className={`h-2.5 w-2.5 rounded-full ${unavailable ? "bg-zinc-300 dark:bg-zinc-600" : method.id === "encrypted_submission" ? "bg-emerald-500" : "bg-blue-500"}`} />
            </div>
            <div className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">{method.label}</div>
            <div className="mt-2">
              <Badge value={unavailable ? "blocked" : method.id === "encrypted_submission" ? "encrypted" : "backend backed"} />
            </div>
          </button>
        );
      })}
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
            className="secondary-button shrink-0 px-2 py-1 text-[11px]"
          >
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
  const preferredMethod = methods[0];
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
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Connection setup</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[var(--text-muted)]">
              Backend-validated connection methods. Secret values stay in Cerebro Vault or deployment-managed references.
            </p>
          </div>
          {selectedMethod && <Badge value={selectedMethod.id.replaceAll("_", " ")} />}
        </div>
      </div>

      <div className="space-y-6 p-5">
        {!anyStoreReady && <StoreReadinessChecklist stores={credentialStores} />}
        {error && <ErrorBlock error={error} />}
        {success && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-[13px] text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100">
            <div className="font-semibold">Connection {success.status}</div>
            <div className="mt-1 text-[12px] leading-5">
              {success.runtimeID} for {success.tenant || "default tenant"} using {success.storeLabel}.
            </div>
          </div>
        )}

        <section>
          <div className="mb-3">
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">Authentication method</div>
            <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">Every option below maps to the server connection contract for this source.</div>
          </div>
          <MethodTabs methods={methods} selectedID={selectedMethodID} onSelect={changeMethod} />
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <label className={labelClass}>
            Tenant
            <input name="tenant_id" defaultValue={tenantID} required placeholder="tenant" className={inputClass} />
          </label>
          <label className={labelClass}>
            Connection ID
            <input name="runtime_id" defaultValue={defaultRuntimeID} required placeholder="tenant-source" className={inputClass} />
          </label>
        </section>

        {selectedMethod && (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-semibold text-[var(--text-primary)]">Credential store</div>
                <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">{selectedMethod.description}</div>
              </div>
              <span className="rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[12px] font-semibold text-[var(--text-secondary)]">
                {selectedStore?.available ? selectedStore.label : "No ready store"}
              </span>
            </div>
            <CredentialStoreSelector stores={visibleStores} selectedID={selectedStoreID} onSelect={setSelectedStoreID} compact />
          </section>
        )}

        {selectedMethod?.commands && selectedMethod.commands.length > 0 && (
          <section className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">CLI preflight</div>
            <CommandBlock commands={selectedMethod.commands} />
          </section>
        )}

        {selectedMethod && (selectedMethod.config_fields?.length ?? 0) > 0 && (
          <section>
            <div className="mb-3">
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">Configuration</div>
            </div>
            <FieldGrid fields={selectedMethod.config_fields ?? []} />
          </section>
        )}

        {selectedMethod && (selectedMethod.credential_fields?.length ?? 0) > 0 && (
          <section>
            <div className="mb-3">
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                {selectedMethod.id === "encrypted_submission" ? "Credential material" : "Credential references"}
              </div>
              <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                {selectedMethod.id === "encrypted_submission"
                  ? "Values are encrypted before submission and cleared after every attempt."
                  : "Enter server-resolvable references only; do not enter secret values."}
              </div>
            </div>
            <FieldGrid fields={selectedMethod.credential_fields ?? []} credential />
          </section>
        )}
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
