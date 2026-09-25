import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { applyMigrations, mailboxMigrations } from "../workers/durableObject/migrations.ts";
import { applyEmailTriageResult } from "../workers/durableObject/triage.ts";
import {
	analyzeInboundEmail,
	buildInboundTriageState,
	decideDisposition,
	MAX_CURRENT_BODY_CHARS,
	MAX_THREAD_MESSAGES,
	MAX_THREAD_MESSAGE_CHARS,
	parseJevResponse,
	type TriageFeatures,
} from "../workers/lib/email-triage.ts";
import {
	createTypeSafeJevProvider,
	TYPESAFE_JEV_ENDPOINT,
	TYPESAFE_JEV_MODEL,
} from "../workers/lib/jev-provider.ts";

function noul(value: number) {
	return { type: "noul", noul: value };
}

function validResponse() {
	return {
		model: "jev-1.13.0",
		answers: {
			category: {
				type: "choice",
				choice: "transactional",
				confidence: 0.9,
				probabilities: { transactional: 0.9, other: 0.1 },
			},
			requires_reply: noul(0.8),
			requires_action: noul(0.7),
			has_deadline: noul(0.6),
			financial_impact: noul(0.5),
			security_relevance: noul(0.4),
			bulk_marketing: noul(0.3),
			direct_personal: noul(0.2),
			calendar_candidate: noul(0.1),
			urgency: {
				type: "score",
				score: 2.2,
				confidence: 0.8,
				probabilities: { "0": 0.05, "1": 0.1, "2": 0.7, "3": 0.15 },
			},
		},
	};
}

test("parses Jev Choice, Noul, and Score answers and preserves model version", () => {
	const result = parseJevResponse(validResponse());
	assert.equal(result.model, "jev-1.13.0");
	assert.equal(result.features.category.choice, "transactional");
	assert.equal(result.features.requiresReply, 0.8);
	assert.equal(result.features.urgency.score, 2.2);

	const newer = parseJevResponse({ ...validResponse(), model: "jev-next" });
	assert.equal(newer.model, "jev-next");
});

test("runs the configured Jev provider with the fixed questions", async () => {
	let call: { state: unknown; questions: any } | undefined;
	const result = await analyzeInboundEmail({
		evaluate: async (state, questions) => {
			call = { state, questions };
			return validResponse();
		},
	}, {
		email: {
			sender: "sender@example.com",
			recipient: "owner@example.com",
			envelopeRecipient: "owner@example.com",
			subject: "Subject",
			bodyText: "Body",
			hasAttachments: false,
		},
		thread: { messageCount: 1, recentMessages: [] },
	});

	assert.equal(call?.questions.category.type, "choice");
	assert.equal(result.features.category.choice, "transactional");
});

test("calls the direct TypeSafe System One API without exposing provider details to triage", async () => {
	let request: { input: string | URL | Request; init?: RequestInit } | undefined;
	const provider = createTypeSafeJevProvider({
		apiKey: "test-key",
		fetch: async (input, init) => {
			request = { input, init };
			return Response.json(validResponse());
		},
	});

	const result = await provider.evaluate({ message: "hello" }, { urgent: { type: "noul" } });
	assert.deepEqual(result, validResponse());
	assert.equal(request?.input, TYPESAFE_JEV_ENDPOINT);
	assert.equal(request?.init?.method, "POST");
	assert.equal((request?.init?.headers as Record<string, string>).Authorization, "Bearer test-key");
	assert.deepEqual(JSON.parse(String(request?.init?.body)), {
		model: TYPESAFE_JEV_MODEL,
		state: { message: "hello" },
		questions: { urgent: { type: "noul" } },
	});
});

test("fails safely when TypeSafe credentials are missing or the API rejects the request", async () => {
	const missingKey = createTypeSafeJevProvider({
		apiKey: undefined,
		fetch: async () => {
			throw new Error("fetch must not be called");
		},
	});
	await assert.rejects(() => missingKey.evaluate({}, {}), /TYPESAFE_API_KEY/);

	const rejected = createTypeSafeJevProvider({
		apiKey: "test-key",
		fetch: async () => new Response('{"error":"invalid key"}', { status: 401 }),
	});
	await assert.rejects(() => rejected.evaluate({}, {}), /TypeSafe Jev request failed \(401\)/);
});

test("rejects incomplete, wrong-type, NaN, and out-of-range Jev answers", () => {
	const missing = validResponse();
	delete missing.answers.urgency;
	assert.throws(() => parseJevResponse(missing));

	const wrongType = structuredClone(validResponse());
	wrongType.answers.requires_reply = { type: "score", score: 1, confidence: 1, probabilities: {} };
	assert.throws(() => parseJevResponse(wrongType));

	const nan = structuredClone(validResponse());
	nan.answers.requires_reply.noul = Number.NaN;
	assert.throws(() => parseJevResponse(nan));

	const outOfRange = structuredClone(validResponse());
	outOfRange.answers.urgency.score = 4;
	assert.throws(() => parseJevResponse(outOfRange));
});

function features(overrides: Partial<TriageFeatures> = {}): TriageFeatures {
	return {
		category: {
			choice: "other",
			confidence: 1,
			probabilities: { other: 1 },
		},
		requiresReply: 0.1,
		requiresAction: 0.1,
		hasDeadline: 0.1,
		financialImpact: 0.1,
		securityRelevance: 0.1,
		bulkMarketing: 0.1,
		directPersonal: 0.1,
		calendarCandidate: 0.1,
		urgency: { score: 0.2, confidence: 1, probabilities: { "0": 1 } },
		...overrides,
	};
}

test("applies disposition policy v1 in priority order", () => {
	assert.equal(decideDisposition(features({ securityRelevance: 0.8 })), "action-required");
	assert.equal(decideDisposition(features({ financialImpact: 0.85 })), "action-required");
	assert.equal(decideDisposition(features({ requiresReply: 0.8 })), "action-required");
	assert.equal(decideDisposition(features({ requiresAction: 0.8 })), "action-required");
	assert.equal(decideDisposition(features({ hasDeadline: 0.75, urgency: { score: 1.5, confidence: 1, probabilities: {} } })), "action-required");
	assert.equal(decideDisposition(features({ bulkMarketing: 0.9 })), "auto-file");
	assert.equal(decideDisposition(features()), "auto-file");
	assert.equal(decideDisposition(features({ requiresAction: 0.4 })), "review");
});

test("builds bounded plain-text Jev state without attachment contents", () => {
	const current = {
		id: "current",
		sender: "sender@example.com",
		recipient: "owner@example.com",
		envelope_recipient: "alias@example.com",
		subject: "Subject",
		body: `<p>${"x".repeat(MAX_CURRENT_BODY_CHARS + 20)}</p>`,
		attachments: [{ filename: "secret.txt", content: "attachment secret" }],
		date: "2026-09-20T12:00:00Z",
		folder_id: "inbox",
	};
	const thread = Array.from({ length: MAX_THREAD_MESSAGES + 2 }, (_, index) => ({
		id: `thread-${index}`,
		sender: `sender-${index}@example.com`,
		recipient: "owner@example.com",
		subject: `Thread ${index}`,
		body: `<p>${"y".repeat(MAX_THREAD_MESSAGE_CHARS + 20)}</p>`,
		date: `2026-09-${String(index + 1).padStart(2, "0")}T12:00:00Z`,
		folder_id: "inbox",
	}));

	const state = buildInboundTriageState(current, thread);
	assert.equal(state.email.envelopeRecipient, "alias@example.com");
	assert.equal(state.email.bodyText.length, MAX_CURRENT_BODY_CHARS);
	assert.equal(state.thread.messageCount, MAX_THREAD_MESSAGES + 3);
	assert.equal(state.thread.recentMessages.length, MAX_THREAD_MESSAGES);
	assert.equal(state.thread.recentMessages[0].bodyText.length, MAX_THREAD_MESSAGE_CHARS);
	assert.equal(state.thread.recentMessages.some(({ subject }) => subject === "Thread 0"), false);
	assert.equal(JSON.stringify(state).includes("attachment secret"), false);
});

test("adds triage analysis migration without losing existing email data", () => {
	const migrationIndex = mailboxMigrations.findIndex(({ name }) => name === "12_add_email_triage_analysis");
	assert.ok(migrationIndex >= 0);

	const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as any;
	const database = new DatabaseSync(":memory:");
	database.exec("PRAGMA foreign_keys = ON");
	const sql = {
		exec(query: string, ...params: (string | number)[]) {
			if (params.length > 0) {
				const statement = database.prepare(query);
				if (/^select/i.test(query.trim())) return statement.all(...params);
				statement.run(...params);
				return [];
			}
			if (/^select/i.test(query.trim())) return database.prepare(query).all();
			database.exec(query);
			return [];
		},
	};
	const storage = {
		sql,
		transactionSync<T>(callback: () => T) {
			database.exec("BEGIN");
			try {
				const result = callback();
				database.exec("COMMIT");
				return result;
			} catch (error) {
				database.exec("ROLLBACK");
				throw error;
			}
		},
	};

	applyMigrations(sql, mailboxMigrations.slice(0, migrationIndex), storage);
	database.prepare(
		"INSERT INTO emails (id, folder_id, subject, body) VALUES (?, ?, ?, ?)",
	).run("email-existing", "inbox", "Existing message", "Existing body");
	applyMigrations(sql, mailboxMigrations, storage);

	database.prepare(
		"INSERT INTO email_tags (email_id, tag, provenance) VALUES (?, ?, ?)",
	).run("email-existing", "disposition:action-required", "manual");
	const result = applyEmailTriageResult(storage, "email-existing", {
		model: "jev-next",
		features: parseJevResponse(validResponse()).features,
		schemaVersion: 1,
		policyVersion: 1,
		predictedDisposition: "review",
	});
	assert.deepEqual(result, {
		dispositionApplied: false,
		manualDispositionPreserved: true,
	});
	assert.equal(
		(database.prepare("SELECT predicted_disposition FROM email_triage_analysis WHERE email_id = ?").get("email-existing") as any).predicted_disposition,
		"review",
	);
	const manualTag = database.prepare(
		"SELECT tag, provenance FROM email_tags WHERE email_id = ? AND tag LIKE 'disposition:%'",
	).get("email-existing") as any;
	assert.equal(manualTag.tag, "disposition:action-required");
	assert.equal(manualTag.provenance, "manual");
	assert.equal(
		(database.prepare("SELECT subject FROM emails WHERE id = ?").get("email-existing") as any).subject,
		"Existing message",
	);
	database.prepare("DELETE FROM emails WHERE id = ?").run("email-existing");
	assert.equal(database.prepare("SELECT COUNT(*) AS count FROM email_triage_analysis").get().count, 0);
	database.close();
});
