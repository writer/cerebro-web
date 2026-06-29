export const GRC_UPLOAD_MAX_BYTES = 32 * 1024 * 1024;
export const GRC_UPLOAD_MAX_LABEL = "32 MB";
export const GRC_UPLOAD_FILE_HELP = "PDF, Word, text, or Markdown. 32 MB max.";

type UploadSizedFile = { size: number };

export const grcUploadTooLargeMessage = () => `Select a file ${GRC_UPLOAD_MAX_LABEL} or smaller.`;

export const isGRCUploadWithinLimit = (file: UploadSizedFile | null | undefined) =>
  !file || file.size <= GRC_UPLOAD_MAX_BYTES;

export const grcUploadFileError = (file: UploadSizedFile | null | undefined) =>
  isGRCUploadWithinLimit(file) ? null : grcUploadTooLargeMessage();
