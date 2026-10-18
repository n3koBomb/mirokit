import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "./index.js";

const FORM_FIELDS = {
	"main-contact": {
		name: "Private sender name",
		email: "visitor@example.org",
		country: "Germany",
		city: "Berlin",
		organization: "Private organization",
		topic: "other",
		message: "Private message https://example.org/private",
		consent_required: "on",
	},
	"extra-contact": {
		organization_full: "Private organization",
		organization_short: "PO",
		address: "Private address",
		country: "Germany",
		city: "Berlin",
		postcode: "10115",
		contact_name: "Private sender name",
		email: "visitor@example.org",
		phone: "+49123456789",
		activities: ["culture"],
		member_count: "10",
		goals: ["goal_cooperation"],
		about: "Private message https://example.org/private",
		confirm_accuracy: "on",
		confirm_goals: "on",
		confirm_privacy: "on",
	},
};

function contactRequest({ formType = "main-contact", language = "de", hostname = "mirokit.com", fields = {} } = {}) {
	return new Request(`https://${hostname}/api/v1/contact`, {
		method: "POST",
		headers: { Origin: `https://${hostname}`, "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1" },
		body: JSON.stringify({
			formType,
			fields: { ...FORM_FIELDS[formType], ...fields },
			turnstileToken: "test-token",
			meta: { language, page: "https://example.org/untrusted-page" },
		}),
	});
}

function mailEnvironment() {
	return {
		ALLOWED_ORIGINS: "https://mirokit.com,https://mirokit.ru,https://ligamirokit.com,https://ligamirokit.ru",
		TURNSTILE_HOSTNAMES: "mirokit.com,mirokit.ru,ligamirokit.com,ligamirokit.ru",
		TURNSTILE_SECRET: "test-secret",
		MAIL_TO: "moderators@example.org",
		USE_SEND_EMAIL_RESPONSE: "true",
		CONTACT_FORM_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
		CONTACT_EMAIL: { send: vi.fn().mockResolvedValue({ messageId: "moderation-id" }) },
		CONTACT_RECEIPT_EMAIL: { send: vi.fn().mockResolvedValue({ messageId: "receipt-id" }) },
	};
}

describe("contact receipt delivery", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({ success: true, action: "contact", hostname: "mirokit.com" })));
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it.each(["false", false, " FALSE ", "", "invalid"])("suppresses receipts for switch value %s while retaining moderator delivery", async (value) => {
		const env = mailEnvironment();
		env.USE_SEND_EMAIL_RESPONSE = value;
		const response = await worker.fetch(contactRequest(), env);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		expect(env.CONTACT_EMAIL.send).toHaveBeenCalledTimes(1);
		expect(env.CONTACT_RECEIPT_EMAIL.send).not.toHaveBeenCalled();
		expect(console.error).not.toHaveBeenCalled();
	});

	it("does not report a missing receipt binding when receipts are disabled", async () => {
		const env = mailEnvironment();
		env.USE_SEND_EMAIL_RESPONSE = "false";
		delete env.CONTACT_RECEIPT_EMAIL;
		expect((await worker.fetch(contactRequest(), env)).status).toBe(200);
		expect(env.CONTACT_EMAIL.send).toHaveBeenCalledTimes(1);
		expect(console.error).not.toHaveBeenCalled();
	});

	it.each(["true", true, " TRUE ", undefined])("permits receipts for switch value %s", async (value) => {
		const env = mailEnvironment();
		if (value === undefined) delete env.USE_SEND_EMAIL_RESPONSE;
		else env.USE_SEND_EMAIL_RESPONSE = value;
		expect((await worker.fetch(contactRequest(), env)).status).toBe(200);
		expect(env.CONTACT_RECEIPT_EMAIL.send).toHaveBeenCalledTimes(1);
	});

	it.each([
		["main-contact", "de", "Deine Nachricht ist angekommen", "Moderatoren"],
		["main-contact", "en", "We have received your message", "moderators"],
		["main-contact", "ru", "Ваше сообщение получено", "модераторы"],
		["extra-contact", "de", "Deine Liga-Anfrage ist angekommen", "Moderatoren"],
		["extra-contact", "en", "We have received your league inquiry", "moderators"],
		["extra-contact", "ru", "Ваше обращение в Лигу получено", "модераторы"],
	])("sends a localized receipt for %s in %s", async (formType, language, subject, moderators) => {
		const env = mailEnvironment();
		vi.mocked(fetch).mockResolvedValue(Response.json({ success: true, action: formType === "extra-contact" ? "league" : "contact", hostname: "mirokit.com" }));
		const response = await worker.fetch(contactRequest({ formType, language }), env);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		expect(env.CONTACT_EMAIL.send).toHaveBeenCalledTimes(1);
		expect(env.CONTACT_EMAIL.send.mock.calls[0][0]).toMatchObject({ to: env.MAIL_TO, replyTo: { email: "visitor@example.org" } });
		expect(env.CONTACT_RECEIPT_EMAIL.send).toHaveBeenCalledTimes(1);
		const receipt = env.CONTACT_RECEIPT_EMAIL.send.mock.calls[0][0];
		expect(receipt).toMatchObject({
			to: "visitor@example.org",
			from: { email: "info@mirokit.com" },
			replyTo: { email: "info@mirokit.com" },
			headers: { "Auto-Submitted": "auto-generated", "Content-Language": language },
		});
		expect(receipt.subject).toContain(subject);
		expect(receipt.text).toContain(moderators);
		expect(receipt.html).toContain(`<html lang="${language}" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">`);
		expect(receipt.html).toContain(moderators);
		expect(JSON.stringify(receipt)).not.toMatch(/Private|untrusted-page|moderators@example\.org/);
		expect(env.CONTACT_EMAIL.send.mock.invocationCallOrder[0]).toBeLessThan(env.CONTACT_RECEIPT_EMAIL.send.mock.invocationCallOrder[0]);
	});

	it.each(["mirokit.com", "mirokit.ru", "ligamirokit.com", "ligamirokit.ru"])("uses the trusted sender for %s", async (hostname) => {
		const env = mailEnvironment();
		vi.mocked(fetch).mockResolvedValue(Response.json({ success: true, action: "contact", hostname }));
		await worker.fetch(contactRequest({ hostname }), env);
		expect(env.CONTACT_RECEIPT_EMAIL.send.mock.calls[0][0].from.email).toBe(hostname.endsWith(".ru") ? "info@mirokit.ru" : "info@mirokit.com");
	});

	it.each([["en-US", "en"], [undefined, "ru"], ["fr", "ru"], ["constructor", "ru"], [{ invalid: true }, "ru"]])("normalizes receipt language %s", async (language, expected) => {
		const env = mailEnvironment();
		// null simulates an absent language without triggering the helper default.
		await worker.fetch(contactRequest({ language: language ?? null }), env);
		expect(env.CONTACT_RECEIPT_EMAIL.send.mock.calls[0][0].headers["Content-Language"]).toBe(expected);
	});

	it("waits for moderator acceptance before scheduling the receipt in the background", async () => {
		const env = mailEnvironment();
		let acceptModeration;
		let acceptReceipt;
		env.CONTACT_EMAIL.send.mockImplementation(() => new Promise((resolve) => { acceptModeration = resolve; }));
		env.CONTACT_RECEIPT_EMAIL.send.mockImplementation(() => new Promise((resolve) => { acceptReceipt = resolve; }));
		const ctx = { waitUntil: vi.fn() };
		const pendingResponse = worker.fetch(contactRequest(), env, ctx);
		await vi.waitFor(() => expect(env.CONTACT_EMAIL.send).toHaveBeenCalledTimes(1));
		expect(env.CONTACT_RECEIPT_EMAIL.send).not.toHaveBeenCalled();
		expect(ctx.waitUntil).not.toHaveBeenCalled();
		acceptModeration({ messageId: "moderation-id" });
		expect((await pendingResponse).status).toBe(200);
		expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
		acceptReceipt({ messageId: "receipt-id" });
		await ctx.waitUntil.mock.calls[0][0];
	});

	it.each(["invalid-fields", "honeypot", "rate-limit", "turnstile", "moderator-delivery"])("sends no receipt for %s", async (reason) => {
		const env = mailEnvironment();
		const fields = {};
		const expectedStatus = { "invalid-fields": 400, honeypot: 200, "rate-limit": 429, turnstile: 403, "moderator-delivery": 502 }[reason];
		if (reason === "invalid-fields") fields.email = "invalid";
		if (reason === "honeypot") fields.website_check = "spam";
		if (reason === "rate-limit") env.CONTACT_FORM_RATE_LIMITER.limit.mockResolvedValue({ success: false });
		if (reason === "turnstile") vi.mocked(fetch).mockResolvedValue(Response.json({ success: false }));
		if (reason === "moderator-delivery") env.CONTACT_EMAIL.send.mockRejectedValue(new Error("Mail unavailable"));
		const response = await worker.fetch(contactRequest({ fields }), env);
		expect(response.status).toBe(expectedStatus);
		expect(env.CONTACT_RECEIPT_EMAIL.send).not.toHaveBeenCalled();
		if (reason !== "moderator-delivery") expect(env.CONTACT_EMAIL.send).not.toHaveBeenCalled();
	});

	it.each(["missing-binding", "send-error"])("keeps the inquiry successful after receipt %s", async (reason) => {
		const env = mailEnvironment();
		if (reason === "missing-binding") delete env.CONTACT_RECEIPT_EMAIL;
		else env.CONTACT_RECEIPT_EMAIL.send.mockRejectedValue(Object.assign(new Error("Private recipient error"), { code: "E_DELIVERY_FAILED" }));
		const response = await worker.fetch(contactRequest(), env);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		expect(env.CONTACT_EMAIL.send).toHaveBeenCalledTimes(1);
		expect(console.error).toHaveBeenCalledWith(expect.stringContaining("receipt"), expect.objectContaining({ code: reason === "missing-binding" ? "MISSING_BINDING" : "E_DELIVERY_FAILED" }));
		expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("Private recipient error");
	});
});
