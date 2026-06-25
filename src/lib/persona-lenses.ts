import { navigationEntries } from "@/lib/routes";

export type PersonaLensID = "security" | "compliance" | "platform" | "leadership";

export type PersonaLensRoute = {
  href: string;
  label: string;
  detail: string;
};

export type PersonaLens = {
  id: PersonaLensID;
  label: string;
  shortLabel: string;
  tagline: string;
  description: string;
  searchPlaceholder: string;
  priorities: string[];
  primaryRoutes: PersonaLensRoute[];
  secondaryRoutes: PersonaLensRoute[];
};

export const DEFAULT_PERSONA_LENS_ID: PersonaLensID = "security";

export const personaLenses: PersonaLens[] = [
  {
    id: "security",
    label: "Security Ops",
    shortLabel: "Security",
    tagline: "Triage active risk and graph blast radius.",
    description: "Open risk, impacted entities, ownership gaps, and the graph paths that explain what to fix first.",
    searchPlaceholder: "Ask or search findings, impact paths, owners...",
    priorities: ["Active risk", "Blast radius", "Ownership", "Response"],
    primaryRoutes: [
      { href: "/", label: "Overview", detail: "Risk pressure, stale sources, and program attention." },
      { href: "/risk-inbox", label: "Risk inbox", detail: "Findings by severity, owner, evidence, SLA, and status." },
      { href: "/impact", label: "Impact map", detail: "Affected entities and graph-backed risk paths." },
      { href: "/ask", label: "Ask graph", detail: "Ask investigation questions and review cited graph rows." },
      { href: "/inventory", label: "Inventory", detail: "Assets, owners, scope, vulnerabilities, and graph context." },
    ],
    secondaryRoutes: [
      { href: "/trends", label: "Trends", detail: "Opened, closed, aged, and breached finding flow." },
      { href: "/explore", label: "Explore", detail: "Free-form graph neighborhood expansion." },
      { href: "/connectors", label: "Connectors", detail: "Source freshness and ingestion health." },
    ],
  },
  {
    id: "compliance",
    label: "Compliance & Audit",
    shortLabel: "Compliance",
    tagline: "Prove controls and evidence readiness.",
    description: "Control posture, framework readiness, evidence packets, coverage gaps, and audit-ready exports.",
    searchPlaceholder: "Ask or search controls, evidence, frameworks...",
    priorities: ["Control status", "Evidence freshness", "Framework gaps", "Audit packets"],
    primaryRoutes: [
      { href: "/", label: "Overview", detail: "Audit readiness, control posture, and proof coverage." },
      { href: "/controls", label: "Controls", detail: "Control status, mapped findings, and evidence gaps." },
      { href: "/frameworks", label: "Frameworks", detail: "Framework readiness, maturity, gaps, planning, and exports." },
      { href: "/evidence", label: "Evidence", detail: "Evidence register linked to findings, rules, and graph roots." },
      { href: "/reports", label: "Reports", detail: "Audit packets with controls, evidence, and impact proof." },
    ],
    secondaryRoutes: [
      { href: "/trends/dashboards", label: "Dashboards", detail: "Saved compliance and trend widgets." },
      { href: "/reports/schedules", label: "Report schedules", detail: "Recurring packet runs and recent scheduled outputs." },
      { href: "/controls/builder", label: "Control Builder", detail: "Custom control packs, coverage preview, and YAML export." },
      { href: "/connectors", label: "Connectors", detail: "Source coverage and freshness for proof." },
      { href: "/risk-inbox", label: "Risk inbox", detail: "Findings that affect controls and framework posture." },
    ],
  },
  {
    id: "platform",
    label: "Platform Owners",
    shortLabel: "Platform",
    tagline: "Keep sources, runtime state, and graph coverage healthy.",
    description: "Connector readiness, runtime freshness, inventory accountability, graph exploration, and operational diagnostics.",
    searchPlaceholder: "Ask or search connectors, runtimes, assets...",
    priorities: ["Source health", "Runtime freshness", "Graph coverage", "Inventory scope"],
    primaryRoutes: [
      { href: "/", label: "Overview", detail: "Connector health, source coverage, and program attention." },
      { href: "/connectors", label: "Connectors", detail: "Connector library, credentials, freshness, and ingestion health." },
      { href: "/inventory", label: "Inventory", detail: "Assets, owners, scope, tests, and graph context." },
      { href: "/explore", label: "Explore", detail: "Free-form graph neighborhood expansion." },
      { href: "/trends", label: "Trends", detail: "Runtime-backed risk and backlog movement." },
    ],
    secondaryRoutes: [
      { href: "/ask", label: "Ask graph", detail: "Ask runtime and coverage questions." },
      { href: "/impact", label: "Impact map", detail: "Entity impact graph and affected paths." },
      { href: "/connectors/source-cdk", label: "Runtime activation", detail: "Source collection scope, access, and trust posture." },
      { href: "/developer", label: "Developer Tools", detail: "API status, OpenAPI resources, and diagnostics." },
    ],
  },
  {
    id: "leadership",
    label: "Leadership",
    shortLabel: "Leadership",
    tagline: "Read program health without the workbench noise.",
    description: "Program readiness, trend direction, material risk, and exportable summaries for planning conversations.",
    searchPlaceholder: "Ask or search program health, trends, reports...",
    priorities: ["Readiness", "Material risk", "Trend direction", "Exports"],
    primaryRoutes: [
      { href: "/", label: "Overview", detail: "Program health, top risk, controls, and source health." },
      { href: "/trends", label: "Trends", detail: "Finding flow, backlog movement, and SLA pressure." },
      { href: "/trends/dashboards", label: "Dashboards", detail: "Saved scorecards and reusable widgets." },
      { href: "/reports", label: "Reports", detail: "Audit and program packets for review." },
      { href: "/impact", label: "Impact map", detail: "Material entity impact and affected paths." },
    ],
    secondaryRoutes: [
      { href: "/frameworks", label: "Frameworks", detail: "Framework readiness and planning." },
      { href: "/risk-inbox", label: "Risk inbox", detail: "Priority findings behind the summary." },
      { href: "/ask", label: "Ask graph", detail: "Ask follow-up questions against the graph." },
    ],
  },
];

const personaLensIDs = new Set<PersonaLensID>(personaLenses.map((lens) => lens.id));
const navigationHrefs = new Set(navigationEntries.map((entry) => entry.href));

export const personaLensByID = Object.fromEntries(
  personaLenses.map((lens) => [lens.id, lens]),
) as Record<PersonaLensID, PersonaLens>;

export function isPersonaLensID(value: string | null | undefined): value is PersonaLensID {
  return Boolean(value && personaLensIDs.has(value as PersonaLensID));
}

export function routeHrefsForLens(lens: PersonaLens) {
  return [...lens.primaryRoutes, ...lens.secondaryRoutes].map((route) => route.href);
}

export function routeRankForLens(lens: PersonaLens, href: string) {
  const index = routeHrefsForLens(lens).indexOf(href);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

export function routeIsAvailable(href: string) {
  return navigationHrefs.has(href);
}
