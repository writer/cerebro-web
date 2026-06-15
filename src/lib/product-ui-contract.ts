export const PRODUCT_UI_CONTRACT_VERSION = "2026-06-15.runtime-contracts";

export const REQUIRED_DEVELOPER_UTILITY_LABELS = [
  "Identity Contract",
  "Security Producers",
  "Raindrop Ask Evals",
] as const;

export const BANNED_PRODUCT_UI_PATTERNS = [
  /repository[\s_-]+split/i,
  /cross[\s_-]+repo\s+contract/i,
  /app[\s_-]+vs[\s_-]+deploy/i,
  /implementation\s+topology/i,
] as const;
