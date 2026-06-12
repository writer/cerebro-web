"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCommandPalette, useSidebar } from "@/components/providers";
import { operatorNavLinks, utilityLinks } from "@/lib/navigation";

const icons: Record<string, React.ReactNode> = {
  "/": <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />,
  "/risk-inbox": <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />,
  "/ask": <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />,
  "/controls": <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />,
  "/evidence": <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />,
  "/inventory": <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5M3.75 9.75h16.5M3.75 14.25h16.5M3.75 18.75h16.5M7.5 3v18m9-18v18" />,
  "/impact": <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />,
  "/reports": <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />,
  "/connectors": <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />,
  "/developer": <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />,
  "/workflows": <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />,
};

function NavIcon({ href }: { href: string }) {
  const d = icons[href];
  if (!d) return <span className="h-[18px] w-[18px]" />;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-[18px] w-[18px] shrink-0">
      {d}
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
      {collapsed
        ? <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
      }
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { openCommandPalette } = useCommandPalette();
  const { collapsed, toggleSidebar } = useSidebar();

  const isActive = (href: string) =>
    href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const renderLink = (link: { href: string; label: string }) => {
    const active = isActive(link.href);
    return (
      <Link
        key={link.href}
        href={link.href}
        title={collapsed ? link.label : undefined}
        className={`flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition ${
          active
            ? "bg-indigo-500/15 text-indigo-400"
            : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
        } ${collapsed ? "justify-center" : ""}`}
      >
        <NavIcon href={link.href} />
        {!collapsed && link.label}
      </Link>
    );
  };

  return (
    <aside className={`flex h-screen flex-col bg-sidebar-bg transition-all duration-200 ${collapsed ? "w-[60px]" : "w-[220px]"}`}>
      <div className={`flex items-center pt-5 pb-4 ${collapsed ? "justify-center px-2" : "px-5"}`}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-[11px] font-bold text-white">
          C
        </div>
        {!collapsed && <span className="ml-2 text-[15px] font-semibold text-white">Cerebro</span>}
      </div>

      {!collapsed && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={openCommandPalette}
            className="flex w-full items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-[7px] text-[13px] text-slate-400 transition hover:bg-white/10 hover:text-slate-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            Search...
            <kbd className="ml-auto rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">⌘K</kbd>
          </button>
        </div>
      )}

      {collapsed && (
        <div className="flex justify-center pb-3">
          <button
            type="button"
            onClick={openCommandPalette}
            title="Search (⌘K)"
            className="rounded-md p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-[18px] w-[18px]">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </button>
        </div>
      )}

      <nav className={`flex-1 space-y-0.5 overflow-y-auto ${collapsed ? "px-1.5" : "px-3"}`}>
        {!collapsed && (
          <div className="px-2 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">Operator</div>
        )}
        {operatorNavLinks.map(renderLink)}

        {!collapsed && (
          <div className="px-2 pb-1.5 pt-5 text-[11px] font-medium uppercase tracking-wider text-slate-500">Advanced</div>
        )}
        {collapsed && <div className="my-3 border-t border-white/10" />}
        {utilityLinks.map(renderLink)}
      </nav>

      <div className="flex items-center justify-between border-t border-white/10 px-3 py-2.5">
        {!collapsed && <div className="text-[11px] text-slate-500">v2.1.86</div>}
        <button
          type="button"
          onClick={toggleSidebar}
          className={`rounded-md p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-slate-300 ${collapsed ? "mx-auto" : ""}`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
      </div>
    </aside>
  );
}
