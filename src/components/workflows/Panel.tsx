import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

export default function Panel({ title, subtitle, action, children }: PanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div>
          <div className="text-[13px] font-semibold text-slate-900">{title}</div>
          {subtitle && (
            <div className="text-[12px] text-slate-500">{subtitle}</div>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
