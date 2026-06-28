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
