import { navigationEntries } from "@/lib/routes";

export type PersonaLensID = "security" | "compliance" | "platform" | "leadership";

export type PersonaLensRoute = {
  href: string;
  label: string;
  detail: string;
};

export type PersonaSignalKey =
  | "activeRisk"
  | "auditReadiness"
  | "controlFailures"
  | "coverageGaps"
  | "evidenceIssues"
  | "highImpact"
  | "ownerGaps"
  | "sourceTrust";

export type PersonaLensSignal = {
  key: PersonaSignalKey;
  label: string;
  href: string;
};

export type PersonaLensAction = {
  href: string;
  label: string;
  detail: string;
};

export type PersonaLensWorkQueue = {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  empty: string;
};

export type PersonaLens = {
  id: PersonaLensID;
  label: string;
  shortLabel: string;
  tagline: string;
  description: string;
  searchPlaceholder: string;
  priorities: string[];
  headline: string;
  summaryFocus: string[];
  signals: PersonaLensSignal[];
  workQueue: PersonaLensWorkQueue;
  decisionFrame: string[];
  nextActions: PersonaLensAction[];
  askPrompts: string[];
  primaryRoutes: PersonaLensRoute[];
  secondaryRoutes: PersonaLensRoute[];
};

export const DEFAULT_PERSONA_LENS_ID: PersonaLensID = "security";

export const personaLenses: PersonaLens[] = [
  {
    id: "security",
    label: "Security",
    shortLabel: "Security",
    tagline: "Risks, owners, evidence, and affected assets.",
    description: "Open risk, impacted entities, ownership gaps, and the graph paths that explain what to fix first.",
    searchPlaceholder: "Ask what is risky, who owns it, or what changed...",
    priorities: ["Active risk", "Affected assets", "Ownership", "Response"],
    headline: "active risks need attention",
    summaryFocus: ["owner gaps", "critical or high risk", "evidence readiness"],
    signals: [
      { key: "activeRisk", label: "Active risks", href: "/risk-inbox" },
      { key: "ownerGaps", label: "Missing owners", href: "/risk-inbox?owner=unassigned" },
      { key: "highImpact", label: "High-impact paths", href: "/impact" },
      { key: "evidenceIssues", label: "Evidence not ready", href: "/evidence" },
      { key: "sourceTrust", label: "Stale sources", href: "/connectors" },
      { key: "coverageGaps", label: "Coverage gaps", href: "/connectors" },
    ],
    workQueue: {
      title: "Fix first",
      description: "Highest-risk open findings with owner, evidence, and due-date context.",
      actionLabel: "View all risks",
      actionHref: "/risk-inbox",
      empty: "No open findings need triage right now.",
    },
    decisionFrame: [
      "Prioritize risk score 85+ before broad backlog review.",
      "Escalate missing owners before remediation stalls.",
      "Use affected assets and evidence gaps to explain urgency.",
    ],
    nextActions: [
      { href: "/risk-inbox?owner=unassigned", label: "Assign owners", detail: "Close accountability gaps on active risks." },
      { href: "/impact", label: "Review affected assets", detail: "Trace what a top finding touches." },
      { href: "/evidence", label: "Collect proof", detail: "Attach or refresh evidence for urgent work." },
    ],
    askPrompts: [
      "What should security fix first and why?",
      "Which open risks have no owner?",
      "Explain the affected assets for the top finding.",
    ],
    primaryRoutes: [
      { href: "/", label: "Home", detail: "Active risk, owners, evidence, and source attention." },
      { href: "/risk-inbox", label: "Risks", detail: "Findings by severity, owner, evidence, SLA, and status." },
      { href: "/impact", label: "Affected assets", detail: "Impacted entities and risk paths." },
      { href: "/ask", label: "Ask Cerebro", detail: "Ask investigation questions and review cited answers." },
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
    label: "Audit",
    shortLabel: "Audit",
    tagline: "Controls, evidence freshness, and export readiness.",
    description: "Control posture, framework readiness, evidence packets, coverage gaps, and audit-ready exports.",
    searchPlaceholder: "Ask or search controls, evidence, frameworks...",
    priorities: ["Control status", "Evidence freshness", "Framework gaps", "Audit packets"],
    headline: "evidence gaps block audit readiness",
    summaryFocus: ["missing or stale evidence", "failing controls", "coverage gaps"],
    signals: [
      { key: "evidenceIssues", label: "Evidence issues", href: "/evidence" },
      { key: "controlFailures", label: "Failing controls", href: "/controls" },
      { key: "auditReadiness", label: "Audit readiness", href: "/reports" },
      { key: "coverageGaps", label: "Scope gaps", href: "/connectors" },
      { key: "activeRisk", label: "Mapped risks", href: "/risk-inbox" },
      { key: "sourceTrust", label: "Stale proof sources", href: "/connectors" },
    ],
    workQueue: {
      title: "Prove next",
      description: "Findings and controls that can block evidence packets or framework readiness.",
      actionLabel: "Review controls",
      actionHref: "/controls",
      empty: "No controls or findings need audit attention right now.",
    },
    decisionFrame: [
      "Start with missing and stale evidence before polishing reports.",
      "Tie every failing control to owners, findings, and proof.",
      "Close source coverage gaps before generating audit packets.",
    ],
    nextActions: [
      { href: "/evidence", label: "Refresh evidence", detail: "Clear missing and stale proof items." },
      { href: "/controls", label: "Review failing controls", detail: "See control status and mapped findings." },
      { href: "/reports", label: "Prepare packet", detail: "Export audit-ready evidence and impact proof." },
    ],
    askPrompts: [
      "Which controls are blocked by missing evidence?",
      "What changed since the last audit packet?",
      "Which findings affect SOC 2 readiness?",
    ],
    primaryRoutes: [
      { href: "/", label: "Home", detail: "Audit readiness, control posture, and proof coverage." },
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
      { href: "/risk-inbox", label: "Risks", detail: "Findings that affect controls and framework posture." },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    shortLabel: "Platform",
    tagline: "Source health, coverage, and accountable inventory.",
    description: "Connector readiness, runtime freshness, inventory accountability, graph exploration, and operational diagnostics.",
    searchPlaceholder: "Ask or search connectors, runtimes, assets...",
    priorities: ["Source health", "Runtime freshness", "Graph coverage", "Inventory scope"],
    headline: "source and ownership signals need hardening",
    summaryFocus: ["stale sources", "coverage gaps", "accountable inventory"],
    signals: [
      { key: "sourceTrust", label: "Source trust", href: "/connectors" },
      { key: "coverageGaps", label: "Coverage gaps", href: "/connectors" },
      { key: "ownerGaps", label: "Owner gaps", href: "/inventory?owner=unassigned" },
      { key: "highImpact", label: "High-risk assets", href: "/inventory?risk=high" },
      { key: "activeRisk", label: "Runtime risks", href: "/risk-inbox" },
      { key: "controlFailures", label: "Control pressure", href: "/controls" },
    ],
    workQueue: {
      title: "Harden trust",
      description: "Sources, assets, and findings that weaken graph trust or ownership accountability.",
      actionLabel: "Review connectors",
      actionHref: "/connectors",
      empty: "Sources and inventory look healthy right now.",
    },
    decisionFrame: [
      "Treat stale source data as a trust issue before debating risk.",
      "Close coverage gaps where controls or high-risk assets depend on them.",
      "Make ownership visible for assets that security or audit will chase.",
    ],
    nextActions: [
      { href: "/connectors", label: "Repair stale sources", detail: "Restore sync and watermark freshness." },
      { href: "/inventory", label: "Confirm owners", detail: "Review high-risk and unassigned assets." },
      { href: "/explore", label: "Inspect graph scope", detail: "Expand nearby entities and source coverage." },
    ],
    askPrompts: [
      "Which stale sources are weakening trust?",
      "Which high-risk assets need an owner?",
      "What source coverage gaps should we close first?",
    ],
    primaryRoutes: [
      { href: "/", label: "Home", detail: "Connector health, source coverage, and program attention." },
      { href: "/connectors", label: "Connectors", detail: "Connector library, credentials, freshness, and ingestion health." },
      { href: "/inventory", label: "Inventory", detail: "Assets, owners, scope, tests, and graph context." },
      { href: "/explore", label: "Explore", detail: "Free-form graph neighborhood expansion." },
      { href: "/trends", label: "Trends", detail: "Runtime-backed risk and backlog movement." },
    ],
    secondaryRoutes: [
      { href: "/ask", label: "Ask Cerebro", detail: "Ask runtime and coverage questions." },
      { href: "/impact", label: "Affected assets", detail: "Entity impact and affected paths." },
      { href: "/connectors/source-cdk", label: "Runtime activation", detail: "Source collection scope, access, and trust posture." },
      { href: "/developer", label: "Developer Tools", detail: "API status, OpenAPI resources, and diagnostics." },
    ],
  },
  {
    id: "leadership",
    label: "Leadership",
    shortLabel: "Leadership",
    tagline: "Program posture, material risk, and trend direction.",
    description: "Program readiness, trend direction, material risk, and exportable summaries for planning conversations.",
    searchPlaceholder: "Ask or search program health, trends, reports...",
    priorities: ["Readiness", "Material risk", "Trend direction", "Exports"],
    headline: "program risks need executive attention",
    summaryFocus: ["material risk", "owner follow-up", "readiness trend"],
    signals: [
      { key: "activeRisk", label: "Open exposure", href: "/risk-inbox" },
      { key: "highImpact", label: "Material paths", href: "/impact" },
      { key: "auditReadiness", label: "Readiness", href: "/reports" },
      { key: "ownerGaps", label: "Owner follow-up", href: "/risk-inbox?owner=unassigned" },
      { key: "controlFailures", label: "Control pressure", href: "/controls" },
      { key: "sourceTrust", label: "Data confidence", href: "/connectors" },
    ],
    workQueue: {
      title: "Briefing queue",
      description: "Material risks and control blockers that need owner follow-up before review.",
      actionLabel: "Open scorecards",
      actionHref: "/trends/dashboards",
      empty: "No material briefing items need attention right now.",
    },
    decisionFrame: [
      "Summarize risk in owner, impact, and trend language.",
      "Separate material blockers from operational backlog noise.",
      "Prefer export-ready packets for recurring review moments.",
    ],
    nextActions: [
      { href: "/trends", label: "Read trend direction", detail: "See backlog movement and SLA pressure." },
      { href: "/reports", label: "Open review packet", detail: "Prepare an exportable program summary." },
      { href: "/risk-inbox", label: "Check owner follow-up", detail: "See risks behind the headline." },
    ],
    askPrompts: [
      "Summarize material risk for this week.",
      "What is getting better or worse?",
      "Which owners need follow-up before review?",
    ],
    primaryRoutes: [
      { href: "/", label: "Home", detail: "Program health, top risk, controls, and source health." },
      { href: "/trends", label: "Trends", detail: "Finding flow, backlog movement, and SLA pressure." },
      { href: "/trends/dashboards", label: "Dashboards", detail: "Saved scorecards and reusable widgets." },
      { href: "/reports", label: "Reports", detail: "Audit and program packets for review." },
      { href: "/impact", label: "Affected assets", detail: "Material entity impact and affected paths." },
    ],
    secondaryRoutes: [
      { href: "/frameworks", label: "Frameworks", detail: "Framework readiness and planning." },
      { href: "/risk-inbox", label: "Risks", detail: "Priority findings behind the summary." },
      { href: "/ask", label: "Ask Cerebro", detail: "Ask follow-up questions against the graph." },
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
