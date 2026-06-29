"use client";

import { AlertTriangle, CheckCircle2, FileText, ListChecks, RefreshCw, X } from "lucide-react";
import type { ReactNode, RefObject } from "react";

import type { GRCUploadResponse } from "@/lib/grc";
import { displayDate, humanize } from "@/lib/grc";
import { GRC_UPLOAD_ACCEPT, GRC_UPLOAD_FILE_HELP, grcUploadFileError, grcUploadFileSizeLabel } from "@/lib/grc-upload-limits";
import { countLabel } from "@/lib/format";

type UploadInputProps = {
  disabled?: boolean;
  file: File | null;
  inputClassName: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onAccepted: (file: File | null) => void;
  onClear: () => void;
  onRejected: (message: string) => void;
};

export function GRCUploadFileInput({
  disabled = false,
  file,
  inputClassName,
  inputRef,
  onAccepted,
  onClear,
  onRejected,
}: UploadInputProps) {
  const clearFile = () => {
    if (inputRef.current) inputRef.current.value = "";
    onClear();
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={GRC_UPLOAD_ACCEPT}
        disabled={disabled}
        onChange={(event) => {
          const selected = event.currentTarget.files?.[0] ?? null;
          const fileError = grcUploadFileError(selected);
          if (fileError) {
            event.currentTarget.value = "";
            onRejected(fileError);
            return;
          }
          onAccepted(selected);
        }}
        className={inputClassName}
      />
      <span className="mt-1 block text-[12px] normal-case tracking-normal text-[var(--text-muted)]">{GRC_UPLOAD_FILE_HELP}</span>
      {file && (
        <div className="mt-2 flex min-h-9 items-center justify-between gap-2 rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-[12px] normal-case tracking-normal text-[var(--text-secondary)]">
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            <span className="truncate font-medium text-[var(--text-primary)]">{file.name}</span>
            <span className="shrink-0 text-[var(--text-muted)]">{grcUploadFileSizeLabel(file.size)}</span>
          </span>
          <button
            type="button"
            onClick={clearFile}
            title="Clear file"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-white hover:text-[var(--text-primary)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}

export function GRCUploadProgress({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[13px] text-[var(--text-secondary)]">
      <span className="inline-flex items-center gap-2">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-[var(--text-muted)]" aria-hidden="true" />
        Reducto is parsing the document and extracting structured fields.
      </span>
      <button type="button" onClick={onCancel} className="text-[12px] font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]">
        Cancel upload
      </button>
    </div>
  );
}

export function GRCUploadErrorActions({
  canRetry,
  error,
  onRetry,
}: {
  canRetry: boolean;
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
      <span className="inline-flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        {error}
      </span>
      {canRetry && (
        <button type="button" onClick={onRetry} className="text-[12px] font-semibold text-red-700 hover:text-red-900 dark:text-red-200 dark:hover:text-red-100">
          Retry upload
        </button>
      )}
    </div>
  );
}

export function GRCUploadReceipt({
  actions,
  upload,
}: {
  actions?: ReactNode;
  upload: GRCUploadResponse;
}) {
  const fields = (upload.structured_fields ?? []).filter((field) => field.key && field.value);
  const eventCount = upload.events?.length ?? 0;
  const projectionStatus = upload.projection_status || (eventCount > 0 ? "projected" : "accepted");
  const hasProjectionWarning = Boolean(upload.projection_failures && upload.projection_failures > 0);
  return (
    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-[13px] text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Uploaded {upload.file_name}.</span>
          </div>
          <div className="mt-1 text-[12px] text-emerald-800 dark:text-emerald-200">
            {countLabel(eventCount, "event")} recorded. {parseDetail(upload)}
          </div>
        </div>
        {actions}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <ReceiptMetric label="Parse" value={humanize(upload.parse_status || "parsed")} />
        <ReceiptMetric label="Structure" value={humanize(upload.structure_status || "structured")} />
        <ReceiptMetric label="Projection" value={humanize(projectionStatus)} warning={hasProjectionWarning} />
        <ReceiptMetric label="Uploaded" value={displayDate(upload.generated_at)} />
      </div>

      {upload.structured_summary && (
        <div className="mt-3 rounded-md border border-emerald-200/80 bg-white/70 px-3 py-2 text-[12px] leading-5 text-emerald-900 dark:border-emerald-500/20 dark:bg-black/10 dark:text-emerald-100">
          <div className="mb-1 font-semibold">Structured summary</div>
          {upload.structured_summary}
        </div>
      )}

      {fields.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[12px] font-semibold text-emerald-900 dark:text-emerald-100">
            Structured fields ({fields.length})
          </summary>
          <dl className="mt-2 grid gap-2 md:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key} className="rounded-md border border-emerald-200/80 bg-white/70 px-3 py-2 dark:border-emerald-500/20 dark:bg-black/10">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-200">{field.label || humanize(field.key || "field")}</dt>
                <dd className="mt-1 break-words text-[12px] leading-5">{field.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      {upload.text_preview && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[12px] font-semibold text-emerald-900 dark:text-emerald-100">Parsed text preview</summary>
          <p className="mt-2 max-h-28 overflow-auto rounded-md border border-emerald-200/80 bg-white/70 px-3 py-2 text-[12px] leading-5 dark:border-emerald-500/20 dark:bg-black/10">
            {upload.text_preview}
          </p>
        </details>
      )}

      {eventCount > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[12px] font-semibold text-emerald-900 dark:text-emerald-100">Created records ({eventCount})</summary>
          <ul className="mt-2 grid gap-2">
            {upload.events.map((event) => (
              <li key={event.event_id} className="rounded-md border border-emerald-200/80 bg-white/70 px-3 py-2 text-[12px] dark:border-emerald-500/20 dark:bg-black/10">
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                  <ListChecks className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-200" aria-hidden="true" />
                  <span>{humanize(event.event_kind)}</span>
                  {event.record_id && <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-200">{event.record_id}</span>}
                </div>
                <div className="mt-1 break-all font-mono text-[11px] text-emerald-700 dark:text-emerald-200">{event.record_urn || event.event_id}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function GRCUploadHistoryList({ uploads }: { uploads: GRCUploadResponse[] }) {
  if (uploads.length <= 1) return null;
  return (
    <details className="mt-3 rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[13px] text-[var(--text-secondary)]">
      <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">Recent uploads ({uploads.length})</summary>
      <ul className="mt-2 grid gap-2">
        {uploads.slice(1).map((upload) => (
          <li key={upload.upload_id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--border)] pt-2 text-[12px]">
            <span className="min-w-0 truncate font-medium text-[var(--text-primary)]">{upload.file_name}</span>
            <span className="text-[var(--text-muted)]">{humanize(upload.parse_status || "parsed")}, {countLabel(upload.events.length, "event")}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function ReceiptMetric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: ReactNode;
  warning?: boolean;
}) {
  return (
    <div className="rounded-md border border-emerald-200/80 bg-white/70 px-3 py-2 dark:border-emerald-500/20 dark:bg-black/10">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-200">{label}</div>
      <div className={`mt-1 break-words text-[12px] font-semibold ${warning ? "text-amber-700 dark:text-amber-200" : ""}`}>{value}</div>
    </div>
  );
}

function parseDetail(upload: GRCUploadResponse) {
  const details = [];
  if (upload.page_count) details.push(countLabel(upload.page_count, "page"));
  if (upload.chunk_count) details.push(countLabel(upload.chunk_count, "chunk"));
  if (upload.structured_fields?.length) details.push(countLabel(upload.structured_fields.length, "field"));
  return details.length > 0 ? `${details.join(", ")} parsed.` : `${humanize(upload.parse_status || "parsed")}.`;
}
