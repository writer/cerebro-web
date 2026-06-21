import { pluralize } from "@/lib/format";
import { riskSort, type GRCDashboard, type GRCFinding, type GRCSummary } from "@/lib/grc";

export type NotificationIntent = "danger" | "warning";

export type AppNotification = {
  id: string;
  signature: string;
  intent: NotificationIntent;
  title: string;
  detail: string;
  href: string;
};

const MAX_FINDING_NOTIFICATIONS = 8;

const isOverdue = (finding: GRCFinding) => (finding.sla_status ?? "").toLowerCase() === "overdue";
const isCritical = (finding: GRCFinding) => (finding.severity ?? "").toUpperCase() === "CRITICAL";
const qualifies = (finding: GRCFinding) => isOverdue(finding) || isCritical(finding);

function findingNotification(finding: GRCFinding): AppNotification {
  const severity = (finding.severity ?? "").toUpperCase() || "UNKNOWN";
  const sla = (finding.sla_status ?? "").toLowerCase();
  const status = (finding.status ?? "").toLowerCase();
  const overdue = isOverdue(finding);
  return {
    id: `finding:${finding.id}`,
    signature: `finding:${finding.id}:${severity}:${sla}:${status}`,
    intent: "danger",
    title: overdue ? `Past SLA: ${finding.title}` : `Critical finding: ${finding.title}`,
    detail: overdue ? `${severity} severity · past remediation SLA` : "Critical severity, open",
    href: `/findings/${finding.id}`,
  };
}

type SummaryRule = {
  id: string;
  count: (summary: GRCSummary) => number;
  title: (count: number) => string;
  detail: string;
  href: string;
};

const SUMMARY_RULES: SummaryRule[] = [
  {
    id: "unassigned-findings",
    count: (summary) => summary.unassigned,
    title: (count) => `${count} unassigned ${pluralize(count, "finding")}`,
    detail: "Open findings without an owner.",
    href: "/risk-inbox?status=open",
  },
  {
    id: "failing-controls",
    count: (summary) => summary.controls_failing,
    title: (count) => `${count} ${pluralize(count, "control")} failing`,
    detail: "Controls with a failing posture.",
    href: "/controls",
  },
  {
    id: "stale-connectors",
    count: (summary) => summary.stale_connectors,
    title: (count) => `${count} stale ${pluralize(count, "connector")}`,
    detail: "Connector ingestion is behind.",
    href: "/connectors",
  },
];

export function buildNotifications(dashboard: GRCDashboard | null | undefined): AppNotification[] {
  if (!dashboard) {
    return [];
  }

  const findingItems = [...(dashboard.findings ?? [])]
    .filter(qualifies)
    .sort(riskSort)
    .slice(0, MAX_FINDING_NOTIFICATIONS)
    .map(findingNotification);

  const summaryItems: AppNotification[] = [];
  if (dashboard.summary) {
    for (const rule of SUMMARY_RULES) {
      const count = rule.count(dashboard.summary);
      if (count > 0) {
        summaryItems.push({
          id: rule.id,
          signature: `${rule.id}:${count}`,
          intent: "warning",
          title: rule.title(count),
          detail: rule.detail,
          href: rule.href,
        });
      }
    }
  }

  return [...findingItems, ...summaryItems];
}

export function unreadNotifications(
  notifications: AppNotification[],
  readSignatures: readonly string[],
): AppNotification[] {
  const read = new Set(readSignatures);
  return notifications.filter((notification) => !read.has(notification.signature));
}

export function notificationSignatures(notifications: AppNotification[]): string[] {
  return notifications.map((notification) => notification.signature);
}
