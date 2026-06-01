export function WorkflowState({
  loading,
  error,
  loadingText = "Loading...",
}: {
  loading?: boolean;
  error?: string | null;
  loadingText?: string;
}) {
  if (loading) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        {loadingText}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
        {error}
      </div>
    );
  }
  return null;
}
