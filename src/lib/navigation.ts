import { supportedGRCFrameworkNames } from "@/lib/grc-frameworks";

export type NavigationEntry = {
  label: string;
  href: string;
  description: string;
  section: "Operator" | "Advanced";
  keywords: string[];
};

export const operatorNavLinks: NavigationEntry[] = [
  {
    label: "Home",
    href: "/",
    description: "Compliance progress, risk, evidence, and connector health.",
    section: "Operator",
    keywords: ["dashboard", "overview", "metrics", "home"],
  },
  {
    label: "Risk inbox",
    href: "/risk-inbox",
    description: "Triage findings by severity, owner, entity, SLA, and evidence.",
    section: "Operator",
    keywords: ["findings", "risk", "sla", "triage", "owner", "framework", ...supportedGRCFrameworkNames],
  },
  {
    label: "Trends",
    href: "/trends",
    description: "Finding flow over time: opened versus closed and the running open backlog.",
    section: "Operator",
    keywords: ["trends", "history", "over time", "burndown", "opened", "closed", "backlog", "chart"],
  },
  {
    label: "Ask graph",
    href: "/ask",
    description: "Ask graph questions. Review drafted Cypher, rows, summaries, and citations.",
    section: "Operator",
    keywords: ["ask", "graph", "cypher", "nlq", "query", "search"],
  },
  {
    label: "Controls",
    href: "/controls",
    description: "Control status, custom framework packs, mapped findings, and evidence gaps.",
    section: "Operator",
    keywords: ["soc2", "iso", "framework", "control", "audit", "builder", "custom", ...supportedGRCFrameworkNames],
  },
  {
    label: "Frameworks",
    href: "/frameworks",
    description: "Framework directory, SOC 2 tracking, maturity, gaps, planning, and exports.",
    section: "Operator",
    keywords: ["soc2", "iso", "framework", "catalog", "maturity", "gap", "planning", "export", ...supportedGRCFrameworkNames],
  },
  {
    label: "Evidence",
    href: "/evidence",
    description: "Evidence register linked to findings, rules, runs, and graph roots.",
    section: "Operator",
    keywords: ["claims", "events", "proof", "audit"],
  },
  {
    label: "Inventory",
    href: "/inventory",
    description: "Browse assets, owners, scope, tests, vulnerabilities, and graph context.",
    section: "Operator",
    keywords: ["assets", "inventory", "resources", "scope", "tests", "vulnerabilities", "framework", ...supportedGRCFrameworkNames],
  },
  {
    label: "Impact map",
    href: "/impact",
    description: "Entity impact graph and affected risk paths.",
    section: "Operator",
    keywords: ["graph", "entity", "impact", "affected entities"],
  },
  {
    label: "Explore",
    href: "/explore",
    description: "Free-form graph exploration: expand any entity's neighbors in place.",
    section: "Operator",
    keywords: ["graph", "explore", "exploration", "expand", "neighbors", "pivot", "free-form", "entity"],
  },
  {
    label: "Reports",
    href: "/reports",
    description: "Build audit packets with evidence, controls, and impact proof.",
    section: "Operator",
    keywords: ["audit packet", "export", "report", "evidence"],
  },
  {
    label: "Connectors",
    href: "/connectors",
    description: "Connector library, credentials, source runtime freshness, and ingestion health.",
    section: "Operator",
    keywords: ["runtimes", "sources", "connectors", "freshness", "credentials"],
  },
];

const commandOnlyNavLinks: NavigationEntry[] = [
  {
    label: "Report schedules",
    href: "/reports/schedules",
    description: "Schedule reports on a fixed interval and review recent scheduled runs.",
    section: "Operator",
    keywords: ["schedule", "scheduled", "recurring", "interval", "report", "delivery", "runs", "cron"],
  },
  {
    label: "Audit Log",
    href: "/developer/audit-log",
    description: "Wide-event timeline, trace drilldown, source runtime diagnostics, and CloudWatch query detail.",
    section: "Advanced",
    keywords: ["audit", "wide events", "otel", "trace", "cloudwatch", "runtime", "logs"],
  },
  {
    label: "Risk scoring",
    href: "/developer/risk-scoring",
    description: "Tune tenant risk thresholds, signal cutoffs, relation weights, and factor weights.",
    section: "Advanced",
    keywords: ["risk", "scoring", "threshold", "cvss", "epss", "weights", "configuration"],
  },
  {
    label: "Control Builder",
    href: "/controls/builder",
    description: "Build custom control packs, preview coverage, and export YAML.",
    section: "Operator",
    keywords: ["builder", "custom framework", "control pack", "yaml", "audit", ...supportedGRCFrameworkNames],
  },
  {
    label: "Source readiness",
    href: "/connectors/source-cdk",
    description: "See what a source collects, the access it needs, and whether you can trust it yet for your program.",
    section: "Operator",
    keywords: ["source", "readiness", "connector", "coverage", "access", "trust", "onboarding"],
  },
];

export const utilityLinks: NavigationEntry[] = [
  {
    label: "Developer Tools",
    href: "/developer",
    description: "API status, OpenAPI resources, and developer utilities.",
    section: "Advanced",
    keywords: ["openapi", "status", "developer", "api"],
  },
];

export const navigationEntries = [
  ...operatorNavLinks,
  ...commandOnlyNavLinks,
  ...utilityLinks,
];
