export const isApiUnavailableError = (error: string | null | undefined) =>
  Boolean(error && /(?:\b50[234]\b|unable to reach|timed out|failed to fetch|fetch failed|networkerror|econnrefused)/i.test(error));
