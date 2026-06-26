import type { GRCFinding } from "@/lib/grc";

type FindingLike = Pick<
  GRCFinding,
  "attributes" | "external_refs" | "runtime_id" | "source_id" | "rule_id"
>;

const compact = (value?: string) => value?.trim() ?? "";

const normalizedTokens = (finding: FindingLike) =>
  [
    finding.source_id,
    finding.runtime_id,
    finding.rule_id,
    finding.attributes?.provider,
    finding.attributes?.saasProvider,
    finding.attributes?.saas_provider,
  ]
    .map((value) => compact(value).toLowerCase())
    .filter(Boolean);

export const isAperioOwnedFinding = (finding: FindingLike) => {
  const tokens = normalizedTokens(finding);
  return (
    tokens.some((token) => token.includes("aperio")) ||
    finding.source_id === "aperio_saas_dr" ||
    Boolean(finding.external_refs?.some((ref) => compact(ref.system).toLowerCase() === "aperio"))
  );
};

export const aperioResponseOwner = (finding: FindingLike) =>
  isAperioOwnedFinding(finding) ? "aperio" : undefined;

export const aperioResponseActionCandidates = (finding: FindingLike): string[] => {
  const candidates = new Set<string>();
  const tokens = normalizedTokens(finding);
  const aperioOwned = isAperioOwnedFinding(finding);
  const hasOAuthContext = Boolean(
    finding.attributes?.oauthAppId ||
      finding.attributes?.oauth_app_id ||
      finding.attributes?.oauthGrantId ||
      finding.attributes?.oauth_grant_id ||
      tokens.some((token) => token.includes("oauth")),
  );

  if (!aperioOwned && !hasOAuthContext) {
    return [];
  }

  if (hasOAuthContext) {
    if (tokens.some((token) => token.includes("google") || token.includes("workspace"))) {
      candidates.add("REVOKE_OAUTH_GRANT");
    }
    if (tokens.some((token) => token.includes("slack") || token.includes("github"))) {
      candidates.add("QUARANTINE_APP");
    }
    if (candidates.size === 0) {
      candidates.add("REVOKE_OAUTH_GRANT");
      candidates.add("QUARANTINE_APP");
    }
  }

  if (aperioOwned && tokens.some((token) => token.includes("okta"))) {
    candidates.add("SUSPEND_USER");
  }
  if (aperioOwned && tokens.some((token) => token.includes("microsoft") || token.includes("m365"))) {
    candidates.add("REVOKE_SESSION");
  }
  if (aperioOwned && tokens.some((token) => token.includes("atlassian"))) {
    candidates.add("REMOVE_EXTERNAL_SHARE");
  }
  if (aperioOwned && tokens.some((token) => token.includes("salesforce"))) {
    candidates.add("REMOVE_ADMIN_ROLE");
  }

  if (aperioOwned) {
    candidates.add("OPEN_TICKET");
    candidates.add("NOTIFY_SECOPS");
  }

  return [...candidates];
};
