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
    keywords: ["findings", "risk", "sla", "triage", "owner"],
  },
  {
    label: "Ask Cerebro",
    href: "/ask",
    description: "Ask the graph in natural language. Cypher is drafted, validated, run, and cited.",
    section: "Operator",
    keywords: ["ask", "graph", "cypher", "nlq", "query", "search"],
  },
  {
    label: "Controls",
    href: "/controls",
    description: "Control posture, failing objectives, and mapped findings.",
    section: "Operator",
    keywords: ["soc2", "iso", "framework", "control", "audit"],
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
    keywords: ["assets", "inventory", "resources", "scope", "tests", "vulnerabilities"],
  },
  {
    label: "Impact map",
    href: "/impact",
    description: "Entity impact graph and related risk blast radius.",
    section: "Operator",
    keywords: ["graph", "entity", "impact", "blast radius"],
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
    description: "Connector library, credentials, connection freshness, and ingestion health.",
    section: "Operator",
    keywords: ["connections", "sources", "connectors", "freshness", "credentials"],
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
  ...utilityLinks,
];
