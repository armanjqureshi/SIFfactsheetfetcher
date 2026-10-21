import { afterEach, describe, expect, it, vi } from "vitest";
import { createPasswordSession, passwordMatches, passwordRequired, verifyPasswordSession } from "./_core/passwordGate";
import { publicPlatformConfig } from "./_core/publicConfig";

afterEach(() => { vi.unstubAllEnvs(); });

describe("password screen for hosted local mode", () => {
  it("is off unless APP_PASSWORD is set", async () => {
    vi.stubEnv("APP_PASSWORD", "");
    expect(passwordRequired()).toBe(false);
    expect(passwordMatches("")).toBe(false);
    expect(await verifyPasswordSession(await createPasswordSession())).toBe(false);
  });

  it("accepts only the exact password", () => {
    vi.stubEnv("APP_PASSWORD", "correct horse battery");
    expect(passwordMatches("correct horse battery")).toBe(true);
    expect(passwordMatches("correct horse batter")).toBe(false);
    expect(passwordMatches("")).toBe(false);
  });

  it("issues sessions that stop working when the password changes", async () => {
    vi.stubEnv("APP_PASSWORD", "first-password");
    const token = await createPasswordSession();
    expect(await verifyPasswordSession(token)).toBe(true);
    expect(await verifyPasswordSession("not-a-token")).toBe(false);
    vi.stubEnv("APP_PASSWORD", "second-password");
    expect(await verifyPasswordSession(token)).toBe(false);
  });

  it("tells the browser where to sign in without exposing the password", () => {
    const env = { LOCAL_MODE: "true", APP_PASSWORD: "secret-value" };
    const config = publicPlatformConfig(env);
    expect(config).toMatchObject({ localMode: true, passwordLogin: true });
    expect(JSON.stringify(config)).not.toContain("secret-value");
  });
});
