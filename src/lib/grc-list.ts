import type { GRCListMeta } from "@/lib/grc";

export const GRC_WORKLIST_LIMIT = 200;
export const GRC_DETAIL_LIMIT = 100;
export const GRC_PICKER_LIMIT = 200;
export const GRC_FILTERED_EXPORT_LIMIT = 500;

export type GRCLoadedRows = {
  loaded: number;
  limit?: number;
  meta?: GRCListMeta;
};

const numericCount = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;

export type GRCBoundedRowsInput<Row> = {
  rows?: Row[] | null;
  limit: number;
  meta?: GRCListMeta;
  total?: number;
};

export const grcBoundedRows = <Row>({
  rows,
  limit,
  meta,
  total,
}: GRCBoundedRowsInput<Row>): { rows: Row[]; meta: GRCListMeta } => {
  const sourceRows = rows ?? [];
  const safeLimit = Math.max(0, Math.floor(limit));
  const boundedRows = sourceRows.slice(0, safeLimit);
  const totalCandidate = numericCount(meta?.total) ?? numericCount(total) ?? sourceRows.length;
  const resolvedTotal = Math.max(totalCandidate, boundedRows.length);

  return {
    rows: boundedRows,
    meta: {
      limit: safeLimit,
      returned: boundedRows.length,
      total: resolvedTotal,
      truncated: Boolean(meta?.truncated ?? (sourceRows.length > boundedRows.length || resolvedTotal > boundedRows.length)),
    },
  };
};

export const grcLoadedRows = ({ loaded, limit, meta }: GRCLoadedRows) => ({
  limit: meta?.limit ?? limit,
  loaded: meta?.returned ?? loaded,
  total: meta?.total,
  truncated: Boolean(meta?.truncated ?? ((meta?.limit ?? limit ?? 0) > 0 && loaded >= (meta?.limit ?? limit ?? 0))),
});

export const grcLoadedRowsCopy = ({
  loaded,
  limit,
  meta,
  noun = "records",
}: GRCLoadedRows & { noun?: string }) => {
  const rows = grcLoadedRows({ loaded, limit, meta });
  const loadedLabel = rows.loaded.toLocaleString();
  const totalLabel = typeof rows.total === "number" ? rows.total.toLocaleString() : "";
  if (totalLabel) {
    return rows.truncated
      ? `Showing ${loadedLabel} of ${totalLabel} ${noun}. Narrow filters or export the full file.`
      : `Showing ${loadedLabel} of ${totalLabel} ${noun}.`;
  }
  if (rows.truncated) {
    return `Showing first ${loadedLabel} ${noun}. Narrow filters or export the full file.`;
  }
  return `Showing ${loadedLabel} ${noun}.`;
};
