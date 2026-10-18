import { describe, expect, it } from "vitest";
import { getCanonicalSiteHostname } from "./hosts.js";

describe("canonical site hostnames", () => {
  it.each([
    ["mirokit.com", "mirokit.com"], ["www.mirokit.com", "mirokit.com"],
    ["ligamirokit.com", "mirokit.com"], ["www.ligamirokit.com", "mirokit.com"],
    ["mirokit.ru", "mirokit.ru"], ["www.mirokit.ru", "mirokit.ru"],
    ["ligamirokit.ru", "mirokit.ru"], ["www.ligamirokit.ru", "mirokit.ru"],
    ["  WWW.LIGAMIROKIT.RU.  ", "mirokit.ru"],
  ])("maps %s to %s", (hostname, canonical) => {
    expect(getCanonicalSiteHostname(hostname)).toBe(canonical);
  });

  it.each([undefined, null, "", "localhost", "127.0.0.1", "mirokit.com..",
    "mirokit.com.evil.test", "evilmirokit.ru", "preview.mirokit.com",
    "https://mirokit.com", "mirokit.com:443", "mirokit.com/path"])("rejects %s", (hostname) => {
    expect(getCanonicalSiteHostname(hostname)).toBeNull();
  });
});
