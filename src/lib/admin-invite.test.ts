import { describe, expect, test } from "bun:test";
import { parseAdminSetupFragment } from "./admin-invite";

describe("parseAdminSetupFragment", () => {
  test("acepta una invitacion completa", () => {
    expect(parseAdminSetupFragment("#access_token=access&refresh_token=refresh&type=invite")).toEqual({
      accessToken: "access",
      refreshToken: "refresh",
      flow: "invite",
    });
  });

  test("acepta un enlace de recuperacion", () => {
    expect(parseAdminSetupFragment("#access_token=access&refresh_token=refresh&type=recovery")).toEqual({
      accessToken: "access",
      refreshToken: "refresh",
      flow: "recovery",
    });
  });

  test("rechaza otros flujos y tokens incompletos", () => {
    expect(parseAdminSetupFragment("#access_token=access&refresh_token=refresh&type=magiclink")).toBeNull();
    expect(parseAdminSetupFragment("#access_token=access&type=invite")).toBeNull();
    expect(parseAdminSetupFragment("")).toBeNull();
  });
});
