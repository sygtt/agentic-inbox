import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { applyMigrations, mailboxMigrations } from "../workers/durableObject/migrations.ts";
import { applyEmailTriageResult, setEmailDisposition, type TriageStorage, } from "../workers/durableObject/triage.ts";
import { DEFAULT_TRIAGE_POLICY, TriagePolicySchema, decideDisposition, type TriageFeatures } from "../workers/lib/email-triage.ts";
import { readTriagePolicy, updateTriagePolicy, compareTriageEmails, reapplyTriagePolicy } from "../workers/durableObject/triage-policy.ts";
function createDatabase(migrations = mailboxMigrations) {
	const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as any;
	const database = new DatabaseSync(":memory:");
	database.exec("PRAGMA foreign_keys = ON");
	const sql = {
		exec(query: string, ...params: (string | number | null)[]) {
			if (params.length > 0) {
				const statement = database.prepare(query);
				if (/^select/i.test(query.trim()))
					return statement.all(...params);
				statement.run(...params);
				return [];
			}
			if (/^select/i.test(query.trim()))
				return database.prepare(query).all();
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
			}
			catch (error) {
				database.exec("ROLLBACK");
				throw error;
			}
		},
	} as TriageStorage;
	applyMigrations(sql as unknown as SqlStorage, migrations, storage);
	return { database, storage };
}
function insertEmail(database: any, id: string) {
	database.prepare("INSERT INTO emails (id, folder_id, subject, body) VALUES (?, ?, ?, ?)").run(id, "inbox", "Subject", "Body");
}
const features: TriageFeatures = {
	category: { choice: "other", confidence: 1, probabilities: { other: 1 } },
	requiresReply: 0,
	requiresAction: 0,
	hasDeadline: 0,
	financialImpact: 0,
	securityRelevance: 0,
	bulkMarketing: 0,
	directPersonal: 0,
	calendarCandidate: 0,
	urgency: { score: 0, confidence: 1, probabilities: { "0": 1 } },
};
test("policy defaults, preview, revision persistence and stale writes", () => {
	const { database, storage } = createDatabase();
	assert.equal(readTriagePolicy(storage).revision, 0);
	for (const id of ["a", "b"]) {
		insertEmail(database, id);
		applyEmailTriageResult(storage, id, { model: "jev-test", features: { ...features, requiresReply: id === "a" ? 0.79 : 0.81 }, schemaVersion: 1, policyVersion: 2, predictedDisposition: id === "a" ? "review" : "action-required" });
	}
	const candidate = { ...DEFAULT_TRIAGE_POLICY, requiresReply: 0.75 };
	const preview = compareTriageEmails(storage, ["a", "b"], candidate);
	assert.deepEqual(preview.emails.map(e => e.candidatePrediction), ["action-required", "action-required"]);
	assert.equal(readTriagePolicy(storage).revision, 0);
	assert.equal(updateTriagePolicy(storage, candidate, 0, "User requested consistency").revision, 1);
	assert.ok("error" in updateTriagePolicy(storage, DEFAULT_TRIAGE_POLICY, 0, "stale"));
	assert.deepEqual(readTriagePolicy(storage).policy, candidate);
	assert.equal(database.prepare("SELECT COUNT(*) AS n FROM triage_policy_history").get().n, 1);
	assert.throws(() => TriagePolicySchema.parse({ ...candidate, requiresReply: NaN }));
	assert.throws(() => TriagePolicySchema.parse({ ...candidate, unexpected: 1 }));
	assert.throws(() => compareTriageEmails(storage, ["a", "a"]));
});
test("reapply preserves manual corrections, history and aborts missing batches", () => {
	const { database, storage } = createDatabase();
	for (const id of ["a", "b"]) {
		insertEmail(database, id);
		applyEmailTriageResult(storage, id, { model: "jev-test", features: { ...features, requiresReply: 0.79 }, schemaVersion: 1, policyVersion: 2, predictedDisposition: "review" });
	}
	const original = compareTriageEmails(storage, ["a"]).emails[0].analysis;
	setEmailDisposition(storage, "b", "auto-file", "manual");
	updateTriagePolicy(storage, { ...DEFAULT_TRIAGE_POLICY, requiresReply: 0.75 }, 0, "test");
	assert.ok("error" in reapplyTriagePolicy(storage, ["a"], 0));
	assert.ok("error" in reapplyTriagePolicy(storage, ["a", "missing"], 1));
	assert.equal(compareTriageEmails(storage, ["a"]).emails[0].currentTags[0].tag, "disposition:review");
	reapplyTriagePolicy(storage, ["a", "b"], 1);
	const result = compareTriageEmails(storage, ["a", "b"]);
	assert.equal(result.emails[0].currentTags[0].tag, "disposition:action-required");
	assert.equal(result.emails[1].currentTags[0].tag, "disposition:auto-file");
	assert.deepEqual(result.emails[0].analysis, original);
	updateTriagePolicy(storage, DEFAULT_TRIAGE_POLICY, 1, "rollback");
	assert.equal(readTriagePolicy(storage).revision, 2);
	assert.equal(decideDisposition(features), "auto-file");
});
test("additive policy migration preserves existing email data", () => {
	const { database, storage } = createDatabase(mailboxMigrations.slice(0, -1));
	insertEmail(database, "old");
	applyMigrations(storage.sql, mailboxMigrations, storage);
	assert.equal(readTriagePolicy(storage).revision, 0);
	assert.equal(database.prepare("SELECT id FROM emails WHERE id='old'").get().id, "old");
});
