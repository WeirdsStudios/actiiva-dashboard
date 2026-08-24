import { describe, expect, test } from "bun:test";
import { createOrganizationSlug } from "./slug";

describe("createOrganizationSlug", () => {
  test("normaliza nombres en español", () => {
    expect(createOrganizationSlug("  Café Muñeca & Más  ")).toBe("cafe-muneca-mas");
  });

  test("usa un valor seguro cuando no quedan caracteres compatibles", () => {
    expect(createOrganizationSlug("火")).toBe("cliente");
  });

  test("limita el slug base para dejar espacio al sufijo de colisión", () => {
    expect(createOrganizationSlug("A".repeat(100))).toHaveLength(70);
  });
});
