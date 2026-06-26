import { describe, expect, it } from "vitest";

import {
  aperioProposalActionForCandidate,
  aperioResponseCandidateHint,
  aperioResponseCandidateHintForCandidate,
} from "./aperio-response-candidate-hints";

describe("aperio response candidate hints", () => {
  it("uses provider metadata from the Aperio producer registry", () => {
    expect(aperioResponseCandidateHintForCandidate("REVOKE_OAUTH_GRANT")).toBe(
      "REVOKE_OAUTH_GRANT (call aperio.propose_cerebro_response with action=REVOKE_OAUTH_GRANT and provider=GOOGLE_WORKSPACE)",
    );
    expect(aperioResponseCandidateHintForCandidate("SUSPEND_USER")).toBe(
      "SUSPEND_USER (call aperio.propose_cerebro_response with action=SUSPEND_USER and provider=OKTA)",
    );
    expect(aperioResponseCandidateHintForCandidate("OPEN_TICKET")).toBe(
      "OPEN_TICKET (call aperio.propose_cerebro_response with action=OPEN_TICKET)",
    );
  });

  it("keeps Web candidates provider-specific while translating Slack and GitHub to Aperio proposal actions", () => {
    expect(aperioProposalActionForCandidate("REMOVE_SLACK_APP")).toBe("QUARANTINE_APP");
    expect(aperioProposalActionForCandidate("REVOKE_GITHUB_OAUTH_APP")).toBe("QUARANTINE_APP");
    expect(aperioResponseCandidateHint([
      "REMOVE_SLACK_APP",
      "REVOKE_GITHUB_OAUTH_APP",
    ])).toBe(
      "REMOVE_SLACK_APP (call aperio.propose_cerebro_response with action=QUARANTINE_APP and provider=SLACK), REVOKE_GITHUB_OAUTH_APP (call aperio.propose_cerebro_response with action=QUARANTINE_APP and provider=GITHUB)",
    );
  });

  it("passes through unknown candidates and keeps the empty fallback concise", () => {
    expect(aperioResponseCandidateHintForCandidate("CUSTOM_ACTION")).toBe("CUSTOM_ACTION");
    expect(aperioResponseCandidateHint([])).toBe("Aperio response proposal");
  });
});
