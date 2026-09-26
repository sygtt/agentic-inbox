import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { applyMigrations, mailboxMigrations } from "../workers/durableObject/migrations.ts";
import {
	applyEmailTriageResult,
	getEmailTriageAnalysis,
	markEmailTriageFailed,
	setEmailDisposition,
} from "../workers/durableObject/triage.ts";
import { handleTriageFailure } from "../workers/agent/triage-failure.ts";
import { TRIAGE_ERROR_TAG } from "../workers/lib/email-tags.ts";
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

function createDatabase() {
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
	applyMigrations(sql as unknown as SqlStorage, mailboxMigrations, storage as any);
	return { database, storage: storage as any };
}

function insertEmail(database: any, id: string) {
	database.prepare("INSERT INTO emails (id, folder_id, subject, body) VALUES (?, ?, ?, ?)")
		.run(id, "inbox", "Subject", "Body");
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

test("marks failed triage idempotently without changing dispositions or unrelated tags", () => {
	for (const provenance of ["agent", "manual"] as const) {
		const { database, storage } = createDatabase();
		const id = `email-${provenance}`;
		insertEmail(database, id);
		database.prepare("INSERT INTO email_tags (email_id, tag, provenance) VALUES (?, ?, ?)")
			.run(id, "disposition:review", provenance);
		database.prepare("INSERT INTO email_tags (email_id, tag, provenance) VALUES (?, ?, ?)")
			.run(id, "source:newsletter", "manual");

		assert.deepEqual(markEmailTriageFailed(storage, id), { tag: TRIAGE_ERROR_TAG, provenance: "agent" });
		markEmailTriageFailed(storage, id);

		const rows = database.prepare(
			"SELECT tag, provenance FROM email_tags WHERE email_id = ? ORDER BY tag",
		).all(id).map((row: { tag: string; provenance: string }) => ({ ...row }));
		assert.deepEqual(rows, [
			{ tag: "disposition:review", provenance },
			{ tag: "source:newsletter", provenance: "manual" },
			{ tag: TRIAGE_ERROR_TAG, provenance: "agent" },
		]);
		database.close();
	}
});

test("successful triage clears triage:error and preserves a manual disposition", () => {
	const { database, storage } = createDatabase();
	insertEmail(database, "email-recovery");
	setEmailDisposition(storage, "email-recovery", "action-required", "manual");
	markEmailTriageFailed(storage, "email-recovery");

	const result = applyEmailTriageResult(storage, "email-recovery", {
		model: "jev-recovered",
		features: features(),
		schemaVersion: 1,
		policyVersion: 2,
		predictedDisposition: "auto-file",
	});

	assert.deepEqual(result, { dispositionApplied: false, manualDispositionPreserved: true });
	assert.equal(database.prepare("SELECT COUNT(*) AS count FROM email_tags WHERE email_id = ? AND tag = ?")
		.get("email-recovery", TRIAGE_ERROR_TAG).count, 0);
	assert.equal(getEmailTriageAnalysis(storage, "email-recovery").analysis?.predictedDisposition, "auto-file");
	assert.equal(database.prepare("SELECT tag FROM email_tags WHERE email_id = ? AND tag LIKE 'disposition:%'")
		.get("email-recovery").tag, "disposition:action-required");
	database.close();
});

test("failed successful-result transaction leaves triage:error in place", () => {
	const { database, storage } = createDatabase();
	insertEmail(database, "email-failed-transaction");
	markEmailTriageFailed(storage, "email-failed-transaction");
	const failingStorage = {
		...storage,
		sql: {
			exec(query: string, ...params: (string | number)[]) {
				if (query.includes("INSERT INTO email_triage_analysis")) throw new Error("analysis persistence failed");
				return storage.sql.exec(query, ...params);
			},
		},
	};

	assert.throws(() => applyEmailTriageResult(failingStorage, "email-failed-transaction", {
		model: "jev-test",
		features: features(),
		schemaVersion: 1,
		policyVersion: 2,
		predictedDisposition: "review",
	}), /analysis persistence failed/);
	assert.equal(database.prepare("SELECT COUNT(*) AS count FROM email_tags WHERE email_id = ? AND tag = ?")
		.get("email-failed-transaction", TRIAGE_ERROR_TAG).count, 1);
	assert.equal(database.prepare("SELECT COUNT(*) AS count FROM email_triage_analysis WHERE email_id = ?")
		.get("email-failed-transaction").count, 0);
	database.close();
});

test("missing email creates no triage:error row", () => {
	const { database, storage } = createDatabase();
	assert.equal(markEmailTriageFailed(storage, "missing-email"), null);
	assert.deepEqual(getEmailTriageAnalysis(storage, "missing-email"), { emailExists: false, analysis: null });
	assert.equal(database.prepare("SELECT COUNT(*) AS count FROM email_tags").get().count, 0);
	database.close();
});

test("failure-marker persistence errors do not replace the original triage failure", async () => {
	const logs: unknown[][] = [];
	const result = await handleTriageFailure(
		new Error("provider rate limit"),
		async () => { throw new Error("database write failed"); },
		(...values) => logs.push(values),
	);
	assert.deepEqual(result, { status: "triage_failed", error: "provider rate limit" });
	assert.deepEqual(logs, [
		["Auto-triage failure marker persistence failed:", "database write failed"],
		["Auto-triage failed:", "provider rate limit"],
	]);

	const missing = await handleTriageFailure(new Error("race after deletion"), async () => null, () => {});
	assert.deepEqual(missing, { status: "email_not_found" });
});

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

test("migrates persisted hold dispositions to auto-file", () => {
	const migrationIndex = mailboxMigrations.findIndex(({ name }) => name === "14_remove_hold_disposition");
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
	database.prepare("INSERT INTO emails (id, folder_id, subject, body) VALUES (?, ?, ?, ?)").run(
		"email-hold", "inbox", "Low signal", "FYI",
	);
	database.prepare("INSERT INTO email_tags (email_id, tag, provenance) VALUES (?, ?, ?)").run(
		"email-hold", "disposition:hold", "manual",
	);
	database.prepare(
		`INSERT INTO email_triage_analysis
			(email_id, schema_version, policy_version, model, features_json, predicted_disposition, analyzed_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run("email-hold", 1, 1, "jev-test", "{}", "hold", "2026-09-21T00:00:00.000Z");

	applyMigrations(sql, mailboxMigrations, storage);

	const tag = database.prepare("SELECT tag, provenance FROM email_tags WHERE email_id = ?").get("email-hold") as any;
	assert.equal(tag.tag, "disposition:auto-file");
	assert.equal(tag.provenance, "manual");
	const analysis = database.prepare(
		"SELECT predicted_disposition, policy_version FROM email_triage_analysis WHERE email_id = ?",
	).get("email-hold") as any;
	assert.equal(analysis.predicted_disposition, "auto-file");
	assert.equal(analysis.policy_version, 2);
	assert.throws(() => database.prepare(
		`INSERT INTO email_triage_analysis
			(email_id, schema_version, policy_version, model, features_json, predicted_disposition, analyzed_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run("email-other", 1, 2, "jev-test", "{}", "hold", "2026-09-21T00:00:00.000Z"));
	database.close();
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
