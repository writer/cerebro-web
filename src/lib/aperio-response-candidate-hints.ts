import { securityProducers } from "./security-producers";

const APERIO_PROPOSAL_ACTION_OVERRIDES: Record<string, string> = {
  // Web keeps provider-specific candidate IDs for runtime routing, while Aperio's MCP catalog
  // accepts the provider-qualified QUARANTINE_APP proposal action for Slack and GitHub.
  REMOVE_SLACK_APP: "QUARANTINE_APP",
  REVOKE_GITHUB_OAUTH_APP: "QUARANTINE_APP",
};

const aperioProducer = securityProducers.find((producer) => producer.id === "aperio");
const aperioResponseActionsByID = new Map(
  (aperioProducer?.responseActions ?? []).map((action) => [action.id, action]),
);

export const aperioProposalActionForCandidate = (candidate: string) =>
  APERIO_PROPOSAL_ACTION_OVERRIDES[candidate] ?? candidate;

export const aperioResponseCandidateHint = (candidates: string[]) => {
  if (candidates.length === 0) return "Aperio response proposal";
  return candidates.map(aperioResponseCandidateHintForCandidate).join(", ");
};

export const aperioResponseCandidateHintForCandidate = (candidate: string) => {
  const action = aperioResponseActionsByID.get(candidate);
  if (!action) return candidate;

  const proposalAction = aperioProposalActionForCandidate(candidate);
  const provider = action.providers.find((candidateProvider) => candidateProvider !== "ALL");
  const providerHint = provider ? ` and provider=${provider}` : "";
  const tool = action.mcpTool ?? "aperio.propose_cerebro_response";
  return `${candidate} (call ${tool} with action=${proposalAction}${providerHint})`;
};
