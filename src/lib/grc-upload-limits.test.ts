import { describe, expect, it } from "vitest";

import {
  GRC_UPLOAD_MAX_BYTES,
  grcUploadFileError,
  isGRCUploadWithinLimit,
} from "./grc-upload-limits";

describe("GRC upload limits", () => {
  it("accepts files at the upload limit", () => {
    expect(isGRCUploadWithinLimit({ size: GRC_UPLOAD_MAX_BYTES })).toBe(true);
    expect(grcUploadFileError({ size: GRC_UPLOAD_MAX_BYTES })).toBeNull();
  });

  it("rejects files above the upload limit", () => {
    expect(isGRCUploadWithinLimit({ size: GRC_UPLOAD_MAX_BYTES + 1 })).toBe(false);
    expect(grcUploadFileError({ size: GRC_UPLOAD_MAX_BYTES + 1 })).toBe("Select a file 32 MB or smaller.");
  });
});
