import { describe, expect, it, vi } from "vitest";
import { isEmail, MAX_EMAIL_LENGTH } from "./email.js";

describe("contact email validation", () => {
  it.each(["visitor@example.org", "first.last+topic@sub.example.co.uk", "besucher@bücher.de"])("accepts %s", (email) => {
    expect(isEmail(email)).toBe(true);
  });
  it.each(["", "@example.org", "user@", "user@example", "user@.org", "user@@example.org", "user name@example.org", "user@example.org\n", "user@exam\tple.org", "user@example.org\u00a0"])("rejects malformed addresses %j", (email) => {
    expect(isEmail(email)).toBe(false);
  });
  it("accepts the length boundary and rejects longer input", () => {
    const email = `${"a".repeat(64)}@${[63, 63, 61].map((n) => "b".repeat(n)).join(".")}`;
    expect(email.length).toBe(MAX_EMAIL_LENGTH);
    expect(isEmail(email)).toBe(true);
    expect(isEmail(`${email}x`)).toBe(false);
  });
  it("rejects the reported repeated-dot attack at short and very large sizes", () => {
    for (const count of [10, 100, 4_000, 500_000]) expect(isEmail(`!@!.${"!.".repeat(count)}@`)).toBe(false);
  });
  it("rejects non-strings without invoking their conversion methods", () => {
    const toString = vi.fn(() => "visitor@example.org");
    for (const value of [undefined, null, 123, ["visitor@example.org"], { toString }]) expect(isEmail(value)).toBe(false);
    expect(toString).not.toHaveBeenCalled();
  });
});
