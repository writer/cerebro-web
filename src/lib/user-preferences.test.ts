import { describe, expect, it } from "vitest";

import {
  HOME_SECTION_IDS,
  defaultUserPreferences,
  normalizeUserPreferences,
  sharedUserPreferencesFromURL,
  userPreferencesRequestBody,
  userPreferencesFromShareValue,
  userPreferencesShareURL,
  userPreferencesShareValue,
} from "./user-preferences";

describe("user preferences", () => {
  it("returns defaults for missing or invalid preference records", () => {
    expect(normalizeUserPreferences(null)).toEqual(defaultUserPreferences);
    expect(normalizeUserPreferences({ homepage: { sections: "bad" }, display: { density: "huge" } })).toEqual(defaultUserPreferences);
  });

  it("preserves disabled home sections", () => {
    const preferences = normalizeUserPreferences({
      homepage: {
        evidenceAutoLoad: true,
        sections: {
          signals: false,
          evidence: false,
        },
      },
      display: {
        density: "compact",
        theme: "dark",
      },
    });

    expect(preferences.homepage.evidenceAutoLoad).toBe(true);
    expect(preferences.homepage.sections.signals).toBe(false);
    expect(preferences.homepage.sections.evidence).toBe(false);
    expect(preferences.homepage.sections.workQueues).toBe(true);
    expect(preferences.display).toEqual({ density: "compact", theme: "dark" });
  });

  it("serializes a complete request body for the backend", () => {
    const payload = JSON.parse(userPreferencesRequestBody(defaultUserPreferences)) as Record<string, unknown>;
    const preferences = payload.preferences as typeof defaultUserPreferences;

    expect(Object.keys(preferences.homepage.sections)).toEqual([...HOME_SECTION_IDS]);
    expect(preferences.display.theme).toBe("light");
  });

  it("round-trips share links for home preferences", () => {
    const preferences = normalizeUserPreferences({
      homepage: {
        evidenceAutoLoad: true,
        sections: {
          findings: false,
        },
      },
      display: {
        density: "compact",
        theme: "dark",
      },
    });
    const value = userPreferencesShareValue(preferences);
    expect(userPreferencesFromShareValue(value)).toEqual(preferences);

    const url = userPreferencesShareURL("https://cerebro.example/risk-inbox?severity=high#row", preferences);
    const shared = sharedUserPreferencesFromURL(url);
    expect(shared?.preferences).toEqual(preferences);
    expect(shared?.cleanedPath).toBe("/");
    expect(userPreferencesFromShareValue(encodeURIComponent(JSON.stringify("bad")))).toBeNull();
  });
});
