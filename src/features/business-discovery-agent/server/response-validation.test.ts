import { describe, expect, test } from "bun:test";
import { validateDiscoveryFile, validateDiscoveryResponse } from "./response-validation";

describe("validateDiscoveryResponse", () => {
  test("accepts a valid exact option", () => {
    const result = validateDiscoveryResponse({ questionId: "biz.years_operating", value: "1_3", status: "draft" });
    expect(result.ok).toBe(true);
  });

  test("rejects an invented option", () => {
    const result = validateDiscoveryResponse({ questionId: "biz.years_operating", value: "1_3_years", status: "draft" });
    expect(result.ok).toBe(false);
  });

  test("derives the section from the pack instead of client input", () => {
    const result = validateDiscoveryResponse({ questionId: "biz.name", value: "Hot Legs Cardio", status: "draft" });
    expect(result.ok && result.data.question.sectionId).toBe("info-general");
  });

  test("normalizes skipped responses to null", () => {
    const result = validateDiscoveryResponse({ questionId: "website.testimonial", value: "dato inesperado", status: "flagged_missing" });
    expect(result.ok && result.data.value).toBeNull();
  });
});

describe("validateDiscoveryFile", () => {
  test("accepts a logo under the server limit", () => {
    const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "logo.png", { type: "image/png" });
    expect(validateDiscoveryFile("brand.logo_file", file).ok).toBe(true);
  });

  test("rejects a type not allowed by the question", () => {
    const file = new File(["contenido"], "logo.pdf", { type: "application/pdf" });
    expect(validateDiscoveryFile("brand.logo_file", file).ok).toBe(false);
  });
});
