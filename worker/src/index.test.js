import { describe, expect, it } from "vitest";

import {
	FORM_FIELD_ALLOWLIST,
	checkContactRateLimit,
	getAllowedOrigins,
	isLocalOrigin,
	validateFields,
} from "./index.js";

describe("contact form field contracts", () => {
	it("keeps separate allowlists for both forms", () => {
		expect(FORM_FIELD_ALLOWLIST["main-contact"].has("message")).toBe(true);
		expect(FORM_FIELD_ALLOWLIST["main-contact"].has("about")).toBe(false);
		expect(FORM_FIELD_ALLOWLIST["extra-contact"].has("about")).toBe(true);
	});

	it("rejects fields that are not part of the form contract", () => {
		expect(() =>
			validateFields("main-contact", {
				name: "MIRoKIT",
				unexpected: "injected value",
			})
		).toThrow("Unknown field: unexpected");
	});

	it("accepts the league form's multi-value groups", () => {
		expect(() =>
			validateFields("extra-contact", {
				activities: ["culture", "education"],
				goals: ["goal_cooperation"],
			})
		).not.toThrow();
	});

	it("rejects nested or repeated scalar values", () => {
		expect(() =>
			validateFields("main-contact", { name: ["one", "two"] })
		).toThrow("Multiple values not allowed: name");
		expect(() =>
			validateFields("main-contact", { name: { value: "MIRoKIT" } })
		).toThrow("Invalid field value: name");
	});
});

describe("local origins", () => {
	it("reads exact origins from the configured list", () => {
		const origins = getAllowedOrigins({
			ALLOWED_ORIGINS: "http://localhost:8080, http://localhost:8787",
		});

		expect(origins.has("http://localhost:8080")).toBe(true);
		expect(origins.has("http://localhost:9999")).toBe(false);
		expect(isLocalOrigin("http://127.0.0.1:8080")).toBe(true);
		expect(isLocalOrigin("https://mirokit.com")).toBe(false);
	});
});

describe("contact rate limit", () => {
	it("uses the form type and client address as the key", async () => {
		const calls = [];
		const result = await checkContactRateLimit(
			new Request("http://localhost:8787/api/contact", {
				headers: { "CF-Connecting-IP": "203.0.113.4" },
			}),
			{
				CONTACT_FORM_RATE_LIMITER: {
					limit: async (input) => {
						calls.push(input);
						return { success: false };
					},
				},
			},
			"main-contact"
		);

		expect(result.success).toBe(false);
		expect(calls).toEqual([{ key: "main-contact:203.0.113.4" }]);
	});

	it("fails closed when the binding is unavailable", async () => {
		await expect(
			checkContactRateLimit(
				new Request("http://localhost:8787/api/contact"),
				{},
				"main-contact"
			)
		).resolves.toEqual({ success: false, unavailable: true });
	});
});
