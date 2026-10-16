import { describe, expect, it } from "vitest";
import { REDACTED, redactBody, redactHeaders, redactText, redactUrl } from "./redact";

describe("T15 redaction", () => {
  it("redacts token-like query parameters by name", () => {
    const out = redactUrl("https://example.com/p?access_token=abc&api_key=k&session_id=s&page=2");
    const u = new URL(out);
    expect(u.searchParams.get("access_token")).toBe(REDACTED);
    expect(u.searchParams.get("api_key")).toBe(REDACTED);
    expect(u.searchParams.get("session_id")).toBe(REDACTED);
    expect(u.searchParams.get("page")).toBe("2");
  });

  it("redacts personal data and click ids", () => {
    const u = new URL(
      redactUrl("https://example.com/?email=a@b.com&phone=9876543210&gclid=xyz&utm_source=news"),
    );
    expect(u.searchParams.get("email")).toBe(REDACTED);
    expect(u.searchParams.get("phone")).toBe(REDACTED);
    expect(u.searchParams.get("gclid")).toBe(REDACTED);
    expect(u.searchParams.get("utm_source")).toBe("news");
  });

  it("redacts secret-looking values under innocuous names", () => {
    const u = new URL(redactUrl("https://example.com/?ref=user@example.org&x=" + "a".repeat(40)));
    expect(u.searchParams.get("ref")).toBe(REDACTED);
    expect(u.searchParams.get("x")).toBe(REDACTED);
  });

  it("strips credentials and token fragments", () => {
    const out = redactUrl("https://u:p@example.com/cb#access_token=zzz&state=1");
    expect(out).not.toContain("u:p");
    expect(out).not.toContain("zzz");
  });

  it("redacts headers, text and beacon bodies", () => {
    expect(redactHeaders({ Authorization: "Bearer x", accept: "*/*" })).toEqual({
      Authorization: REDACTED,
      accept: "*/*",
    });
    expect(redactText("contact jane@corp.com")).toBe("contact [email]");
    const body = redactBody("v=2&tid=G-ABC123&cid=555.666&en=page_view&ep.email=a%40b.com");
    expect(body).toContain("tid=G-ABC123");
    expect(body).toContain("en=page_view");
    expect(body).toContain(`cid=${REDACTED}`);
    expect(body).not.toContain("a%40b.com");
  });
});
