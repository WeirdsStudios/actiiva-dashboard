import { describe, expect, test } from "bun:test";
import { redactSensitiveFinancialNumbers, validateImageSignature } from "./content-safety";

describe("redactSensitiveFinancialNumbers", () => {
  test("redacts a CLABE before it reaches history or the model", () => {
    expect(redactSensitiveFinancialNumbers("Mi CLABE es 646180157034181180")).toBe(
      "Mi CLABE es [dato financiero omitido por seguridad]",
    );
  });

  test("does not redact a normal Mexican phone number", () => {
    expect(redactSensitiveFinancialNumbers("Mi teléfono es 5512345678")).toBe("Mi teléfono es 5512345678");
  });
});

describe("validateImageSignature", () => {
  test("rejects a PDF renamed as PNG", async () => {
    const file = new File(["%PDF-1.7"], "foto.png", { type: "image/png" });
    expect((await validateImageSignature(file)).ok).toBe(false);
  });

  test("rejects executable content inside SVG", async () => {
    const file = new File(["<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"], "logo.svg", { type: "image/svg+xml" });
    expect((await validateImageSignature(file)).ok).toBe(false);
  });
});
