"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { countLabel } from "@/lib/format";
import type { GRCListMeta } from "@/lib/grc";
import { grcLoadedRowsCopy } from "@/lib/grc-list";

export type TableColumn<Row extends object = Record<string, unknown>> = {
  key: string;
  label?: string;
  render?: (value: unknown, row: Row) => ReactNode;
};

export const formatValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? countLabel(value.length, "item") : "[]";
  }
  if (typeof value === "object") {
    return "{...}";
  }
  return String(value);
};

const valueText = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
};

export function KeyValueList({
  data,
  emptyMessage = "No data available.",
}: {
  data?: Record<string, unknown> | null;
  emptyMessage?: string;
}) {
  if (!data || Object.keys(data).length === 0) {
    return <div className="text-xs text-[var(--text-muted)]">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-2 text-xs text-[var(--text-secondary)]">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex justify-between gap-4">
          <span className="text-[var(--text-muted)]">{key}</span>
          <span className="text-right text-[var(--text-primary)]">
            {formatValue(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export type DataTableProps<Row extends object = Record<string, unknown>> = {
  rows: Row[];
  columns?: TableColumn<Row>[];
  emptyMessage?: string;
  searchPlaceholder?: string;
  filterKeys?: string[];
  pageSize?: number;
  getRowHref?: (row: Row) => string | undefined;
  getRowKey?: (row: Row, index: number) => string;
  onRowClick?: (row: Row) => void;
  rowActions?: (row: Row) => ReactNode;
  selectedRowKey?: string | null;
  tableContainerClassName?: string;
  resultLimit?: number;
  resultMeta?: GRCListMeta;
  resultNoun?: string;
};

const rowValue = <Row extends object>(row: Row, key: string) =>
  (row as Record<string, unknown>)[key];

export default function DataTable<Row extends object = Record<string, unknown>>({
  rows,
  columns,
  emptyMessage = "No rows available.",
  searchPlaceholder = "Filter loaded rows",
  filterKeys,
  pageSize = 10,
  getRowHref,
  getRowKey,
  onRowClick,
  rowActions,
  selectedRowKey,
  tableContainerClassName = "overflow-auto rounded-lg border border-[color:var(--border)] bg-[var(--surface)]",
  resultLimit,
  resultMeta,
  resultNoun = "rows",
}: DataTableProps<Row>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const resolvedColumns = useMemo<TableColumn<Row>[]>(
    () => columns ?? Object.keys(rows?.[0] ?? {}).slice(0, 6).map((key) => ({ key })),
    [columns, rows],
  );
  const searchableKeys = useMemo(
    () => filterKeys ?? resolvedColumns.map((column) => column.key),
    [filterKeys, resolvedColumns],
  );
  const rowSearchText = useMemo(
    () =>
      (rows ?? []).map((row) =>
        searchableKeys.map((key) => valueText(rowValue(row, key))).join("\n").toLowerCase(),
      ),
    [rows, searchableKeys],
  );
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return rows ?? [];
    }
    return (rows ?? []).filter((_row, index) =>
      rowSearchText[index]?.includes(normalizedQuery),
    );
  }, [query, rows, rowSearchText]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleRows = filteredRows.slice(pageStart, pageStart + pageSize);
  const resultCopy = grcLoadedRowsCopy({
    loaded: rows?.length ?? 0,
    limit: resultLimit,
    meta: resultMeta,
    noun: resultNoun,
  });
  const queryActive = query.trim().length > 0;
  const filteredCopy = `Matched ${filteredRows.length.toLocaleString()} loaded ${resultNoun}`;

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-4 text-xs text-[var(--text-muted)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder={searchPlaceholder}
          className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[color:var(--ring)] focus:outline-none focus:ring-1 focus:ring-[color:var(--ring)] sm:max-w-xs"
        />
        <div className="text-xs text-[var(--text-muted)]">
          {queryActive ? filteredCopy : resultCopy}
          {totalPages > 1 && (
            <span>
              {" "}Rows {filteredRows.length === 0 ? 0 : pageStart + 1}-
              {Math.min(pageStart + pageSize, filteredRows.length)}
            </span>
          )}
        </div>
      </div>
      {filteredRows.length === 0 ? (
        <div className="rounded-md border border-dashed border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-4 text-xs text-[var(--text-muted)]">
          No rows match the current filter.
        </div>
      ) : (
        <div className={tableContainerClassName}>
          <table className="w-full text-left text-xs text-[var(--text-secondary)]">
            <thead className="border-b border-[color:var(--border)] bg-[var(--surface-muted)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <tr>
                {resolvedColumns.map((column) => (
                  <th key={column.key} className="px-3 py-2 font-semibold">
                    {column.label ?? column.key}
                  </th>
                ))}
                {getRowHref && <th className="px-3 py-2 font-semibold">Link</th>}
                {rowActions && <th className="px-3 py-2 font-semibold"></th>}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => {
                const href = getRowHref?.(row);
                const key = getRowKey?.(row, pageStart + index) ?? String(rowValue(row, "id") ?? `${pageStart}-${index}`);
                const selected = selectedRowKey !== undefined && selectedRowKey !== null && key === selectedRowKey;
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`border-b border-[color:var(--border)] hover:bg-[var(--surface-muted)] ${onRowClick ? "cursor-pointer" : ""} ${selected ? "bg-indigo-50/70 dark:bg-indigo-500/15" : ""}`}
                  >
                    {resolvedColumns.map((column) => (
                      <td key={column.key} className="px-3 py-2">
                        {column.render
                          ? column.render(rowValue(row, column.key), row)
                          : formatValue(rowValue(row, column.key))}
                      </td>
                    ))}
                    {getRowHref && (
                      <td className="px-3 py-2">
                        {href ? (
                          <Link className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300" href={href}>
                            Open
                          </Link>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    )}
                    {rowActions && (
                      <td className="px-3 py-2 text-right">
                        {rowActions(row)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="rounded-md border border-[color:var(--border)] px-2 py-1 text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-[var(--text-muted)]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="rounded-md border border-[color:var(--border)] px-2 py-1 text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export function WorklistTable<Row extends object = Record<string, unknown>>({
  title,
  description,
  action,
  refreshing,
  ...tableProps
}: DataTableProps<Row> & {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  refreshing?: boolean;
}) {
  return (
    <div className="surface-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-3.5">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</h2>
          {description && <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{description}</p>}
        </div>
        {action}
      </div>
      {refreshing && (
        <div className="border-b border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-[12px] text-[var(--text-muted)]">
          Refreshing...
        </div>
      )}
      <div className="p-4">
        <DataTable {...tableProps} tableContainerClassName="overflow-auto" />
      </div>
    </div>
  );
}
