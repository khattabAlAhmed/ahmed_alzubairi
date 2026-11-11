import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  DOCUMENT_VIEW_COPY_TTL_HOURS,
  EMAIL_MAX_ATTEMPTS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_LONG_TEXT_LENGTH,
  MAX_NOTIFICATION_IDS,
  MAX_PAGE_SIZE,
  MAX_SHORT_TEXT_LENGTH,
  MEETING_REMINDER_HOURS_BEFORE,
  PHONE_MAX_DIGITS,
  PHONE_MIN_DIGITS,
  SIGNED_URL_TTL_SECONDS,
} from "./limits";

describe("limits", () => {
  it("holds the numbers §6 fixes", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(10_485_760);
    expect(MAX_ATTACHMENTS_PER_MESSAGE).toBe(5);
    expect(SIGNED_URL_TTL_SECONDS).toBe(60);
    expect(DOCUMENT_VIEW_COPY_TTL_HOURS).toBe(1);
    expect(MEETING_REMINDER_HOURS_BEFORE).toBe(24);
    expect(PHONE_MIN_DIGITS).toBe(7);
    expect(PHONE_MAX_DIGITS).toBe(15);
    expect(MAX_SHORT_TEXT_LENGTH).toBe(200);
    expect(MAX_LONG_TEXT_LENGTH).toBe(5000);
  });

  it("holds the Phase 3 numbers", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(MAX_PAGE_SIZE).toBe(100);
    expect(MAX_NOTIFICATION_IDS).toBe(100);
    expect(EMAIL_MAX_ATTEMPTS).toBe(5);
  });
});
