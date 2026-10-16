import { describe, expect, it } from "vitest";
import { checkRequest, hostnameOf, parseAllowedHosts, type GuardInput } from "./request-guard";

const base: GuardInput = {
  method: "GET",
  host: "127.0.0.1:3000",
  origin: null,
  secFetchSite: null,
  tokenConfigured: false,
  demo: false,
  allowedHosts: [],
};
const run = (o: Partial<GuardInput>) => checkRequest({ ...base, ...o });

describe("request guard", () => {
  it("parses hostnames with ports and IPv6", () => {
    expect(hostnameOf("127.0.0.1:3000")).toBe("127.0.0.1");
    expect(hostnameOf("LocalHost")).toBe("localhost");
    expect(hostnameOf("[::1]:3000")).toBe("[::1]");
    expect(parseAllowedHosts(" a.local, ,B.local ")).toEqual(["a.local", "b.local"]);
  });

  it("allows loopback hosts without a token", () => {
    for (const host of ["127.0.0.1:3000", "localhost:3000", "[::1]:3000", "localhost"])
      expect(run({ host }).ok).toBe(true);
  });

  it("blocks DNS-rebinding hosts when no token is configured", () => {
    expect(run({ host: "attacker.example:3000" })).toMatchObject({ ok: false, status: 421 });
    expect(run({ host: null })).toMatchObject({ ok: false, status: 421 });
    expect(run({ host: "127.0.0.1.attacker.example" }).ok).toBe(false);
  });

  it("accepts configured hosts, tokened instances and demo mode", () => {
    expect(run({ host: "audit.lan:8080", allowedHosts: ["audit.lan"] }).ok).toBe(true);
    expect(run({ host: "audit.example.com", tokenConfigured: true }).ok).toBe(true);
    expect(run({ host: "demo.example.com", demo: true }).ok).toBe(true);
  });

  it("blocks cross-site state-changing requests (drive-by CSRF)", () => {
    expect(run({ method: "POST", origin: "https://evil.example" })).toMatchObject({ status: 403 });
    expect(run({ method: "POST", secFetchSite: "cross-site" })).toMatchObject({ status: 403 });
    expect(run({ method: "POST", secFetchSite: "same-site" })).toMatchObject({ status: 403 });
    expect(run({ method: "DELETE", origin: "null" })).toMatchObject({ status: 403 });
    expect(run({ method: "POST", origin: "http://127.0.0.1:3001" })).toMatchObject({ status: 403 });
  });

  it("allows same-origin browser requests and non-browser clients", () => {
    expect(run({ method: "POST", origin: "http://127.0.0.1:3000", secFetchSite: "same-origin" }).ok).toBe(
      true,
    );
    expect(run({ method: "POST" }).ok).toBe(true);
    expect(run({ method: "GET", origin: "https://evil.example" }).ok).toBe(true);
  });
});
