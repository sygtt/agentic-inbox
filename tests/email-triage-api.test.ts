import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { requireMailbox } from "../workers/lib/mailbox.ts";
import { registerEmailTriageRoutes } from "../workers/lib/email-triage-api.ts";

function createApiRequest() {
	const analysis = {
		schemaVersion: 1,
		policyVersion: 2,
		model: "jev-1.13.0",
		features: { category: { choice: "marketing", confidence: 0.9, probabilities: { marketing: 0.9 } } },
		predictedDisposition: "auto-file",
		analyzedAt: "2026-09-26T12:00:00.000Z",
	};
	const stub = {
		getEmailTriageAnalysis: async (id: string) => id === "missing"
			? { emailExists: false, analysis: null }
			: { emailExists: true, analysis: id === "without-analysis" ? null : analysis },
	};
	const env = {
		BUCKET: { head: async (key: string) => key === "mailboxes/test@example.com.json" ? {} : null },
		MAILBOX: { idFromName: (id: string) => id, get: () => stub },
	} as any;
	const app = new Hono<any>();
	app.use("/api/v1/mailboxes/:mailboxId/*", requireMailbox);
	registerEmailTriageRoutes(app);
	return (id: string) => app.request(
		`/api/v1/mailboxes/test@example.com/emails/${id}/triage`,
		undefined,
		env,
	);
}

test("serves persisted triage analysis and returns null when analysis is absent", async () => {
	const request = createApiRequest();
	let response = await request("email-1");
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), {
		schemaVersion: 1,
		policyVersion: 2,
		model: "jev-1.13.0",
		features: { category: { choice: "marketing", confidence: 0.9, probabilities: { marketing: 0.9 } } },
		predictedDisposition: "auto-file",
		analyzedAt: "2026-09-26T12:00:00.000Z",
	});

	response = await request("without-analysis");
	assert.equal(response.status, 200);
	assert.equal(await response.json(), null);
});

test("returns 404 for an email that no longer exists", async () => {
	const response = await createApiRequest()("missing");
	assert.equal(response.status, 404);
	assert.deepEqual(await response.json(), { error: "Email not found" });
});
