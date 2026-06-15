"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import CredentialStoreSelector from "@/components/connectors/CredentialStoreSelector";
import { ErrorBlock } from "@/components/grc/Primitives";
import { fetchCerebro } from "@/lib/cerebro-client";
import type {
  ConnectorCatalogEntry,
  ConnectorCredentialKey,
  ConnectorCredentialStoreID,
  NormalizedCredentialStore,
} from "@/lib/connectors";
import {
  connectorSubmitErrorMessage,
  defaultCredentialStoreID,
  encryptConnectorCredentials,
  fieldSetForConnector,
} from "@/lib/connectors";

const labelClass = "text-[11px] font-semibold text-[var(--text-muted)]";
const inputClass = "control-input mt-1 w-full px-3 py-2 text-[13px]";

const readConfigField = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const readCredentialField = (formData: FormData, key: string) => String(formData.get(key) ?? "");

function clearCredentialInputs(form: HTMLFormElement, names: string[]) {
  names.forEach((name) => {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      field.value = "";
    }
  });
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
  const fields = useMemo(() => fieldSetForConnector(connector.source_id), [connector.source_id]);
  const [selectedStoreID, setSelectedStoreID] = useState<ConnectorCredentialStoreID>(() => defaultCredentialStoreID(credentialStores));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const defaultRuntimeID = [tenantID || "tenant", connector.source_id].filter(Boolean).join("-");
  const selectedStore = credentialStores.find((store) => store.id === selectedStoreID) ?? credentialStores[0];
  const canSubmit = Boolean(selectedStore?.available && !submitting);

  useEffect(() => {
    const current = credentialStores.find((store) => store.id === selectedStoreID);
    if (!current?.available) {
      setSelectedStoreID(defaultCredentialStoreID(credentialStores));
    }
  }, [credentialStores, selectedStoreID]);

  const submitConnection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!selectedStore?.available) {
      setError("Selected credential store is unavailable.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const formData = new FormData(form);
    const runtimeID = readConfigField(formData, "runtime_id");
    const tenant = readConfigField(formData, "tenant_id");
    const config: Record<string, string> = {};
    const credentials: Record<string, string> = {};
    try {
      fields.config.forEach((field) => {
        const value = readConfigField(formData, field.key);
        if (value) config[field.key] = value;
      });
      fields.credentials.forEach((field) => {
        const value = readCredentialField(formData, field.key);
        if (value) credentials[field.key] = value;
      });
      const keyResponse = await fetchCerebro<ConnectorCredentialKey>("/connectors/credential-key", apiKey);
      if (!keyResponse.ok) throw new Error(connectorSubmitErrorMessage(keyResponse.status));
      const encryptedCredentials = await encryptConnectorCredentials(keyResponse.data, credentials, {
        sourceID: connector.source_id,
        tenantID: tenant,
        runtimeID,
        credentialStoreID: selectedStore.id,
      });
      const response = await fetchCerebro(`/connectors/${encodeURIComponent(connector.source_id)}/connections`, apiKey, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runtime_id: runtimeID,
          tenant_id: tenant,
          credential_store_id: selectedStore.id,
          config,
          encrypted_credentials: encryptedCredentials,
        }),
      });
      if (!response.ok) throw new Error(connectorSubmitErrorMessage(response.status));
      setSuccess("Connection saved. Credential fields were cleared.");
      form.reset();
      await onConnected();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : connectorSubmitErrorMessage());
    } finally {
      Object.keys(credentials).forEach((key) => {
        credentials[key] = "";
      });
      clearCredentialInputs(form, fields.credentials.map((field) => field.key));
      setSubmitting(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={submitConnection} className="surface-panel overflow-hidden">
      <div className="border-b border-[color:var(--border)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Create connection</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[var(--text-muted)]">
              Configure where credentials are stored, then submit a one-time encrypted credential payload to Cerebro.
            </p>
          </div>
          {selectedStore && (
            <span className="rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[12px] font-semibold text-[var(--text-secondary)]">
              {selectedStore.available ? selectedStore.shortLabel : "No store"}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-6 p-5">
        {error && <ErrorBlock error={error} />}
        {success && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-[13px] text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100">
            {success}
          </div>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">Connection identity</div>
              <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">Use generic IDs; avoid embedding secret names or deployment details.</div>
            </div>
          </div>
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
        </section>

        <section>
          <div className="mb-3">
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">Secret store</div>
            <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">Only stores advertised by this Cerebro deployment can be selected.</div>
          </div>
          <CredentialStoreSelector stores={credentialStores} selectedID={selectedStoreID} onSelect={setSelectedStoreID} />
        </section>

        {fields.config.length > 0 && (
          <section>
            <div className="mb-3">
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">Configuration</div>
              <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">Non-secret source settings sent as connection config.</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {fields.config.map((field) => (
                <label key={field.key} className={labelClass}>
                  {field.label}{field.required ? " *" : ""}
                  <input name={field.key} required={field.required} placeholder={field.placeholder} className={inputClass} />
                </label>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3">
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">Credential material</div>
            <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">
              Existing stored secrets are never displayed. New values are encrypted before submission and cleared after every attempt.
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {fields.credentials.map((field) => (
              <label key={field.key} className={labelClass}>
                {field.label}{field.required ? " *" : ""}
                <input name={field.key} type={field.type ?? "password"} required={field.required} autoComplete="new-password" className={inputClass} />
              </label>
            ))}
          </div>
        </section>

        <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-4 text-[12px] leading-5 text-[var(--text-secondary)]">
          Credential requests use the connector transit key and bind encrypted payloads to the connector, tenant, connection ID, and selected store. Error messages on this page are intentionally sanitized.
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] bg-[var(--surface-muted)] px-5 py-4">
        <button type="button" onClick={() => formRef.current?.reset()} className="secondary-button px-3 py-2 text-[13px]">
          Reset
        </button>
        <button type="submit" disabled={!canSubmit} className="primary-button px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-55">
          {submitting ? "Saving..." : "Save connection"}
        </button>
      </div>
    </form>
  );
}
