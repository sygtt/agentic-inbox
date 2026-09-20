import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { applyMigrations, mailboxMigrations } from "../workers/durableObject/migrations.ts";
import {
	applyEmailTriageResult,
	setEmailDisposition,
	type TriageStorage,
} from "../workers/durableObject/triage.ts";
import type { TriageFeatures } from "../workers/lib/email-triage.ts";

function createDatabase(migrations = mailboxMigrations) {
	const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as any;
	const database = new DatabaseSync(":memory:");
	database.exec("PRAGMA foreign_keys = ON");
	const sql = {
		exec(query: string, ...params: (string | number | null)[]) {
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
	} as TriageStorage;

	applyMigrations(sql as unknown as SqlStorage, migrations, storage);
	return { database, storage };
}

function insertEmail(database: any, id: string) {
	database.prepare(
		"INSERT INTO emails (id, folder_id, subject, body) VALUES (?, ?, ?, ?)",
	).run(id, "inbox", "Subject", "Body");
}

function insertAnalysis(database: any, id: string) {
	database.prepare(
		`INSERT INTO email_triage_analysis
			(email_id, schema_version, policy_version, model, features_json, predicted_disposition, analyzed_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run(id, 2, 3, "jev-test", "{}", "review", "2026-09-20T12:00:00.000Z");
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

test("captures manual corrections with triage provenance and remains atomic", () => {
	const { database, storage } = createDatabase();
	insertEmail(database, "email-1");
	insertAnalysis(database, "email-1");
	database.prepare(
		"INSERT INTO email_tags (email_id, tag, provenance) VALUES (?, ?, ?)",
	).run("email-1", "disposition:review", "agent");

	setEmailDisposition(storage, "email-1", "action-required", "manual");
	setEmailDisposition(storage, "email-1", "auto-file", "manual");
	const feedback = database.prepare(
		`SELECT id, event_type, previous_value, new_value,
			feature_schema_version, policy_version, model, created_at
		 FROM email_triage_feedback WHERE email_id = ? ORDER BY rowid`,
	).all("email-1") as any[];
	assert.equal(feedback.length, 2);
	assert.notEqual(feedback[0].id, feedback[1].id);
	assert.deepEqual(
		feedback.map(({ event_type, previous_value, new_value }) => ({ event_type, previous_value, new_value })),
		[
			{ event_type: "manual_disposition", previous_value: "review", new_value: "action-required" },
			{ event_type: "manual_disposition", previous_value: "action-required", new_value: "auto-file" },
		],
	);
	assert.equal(feedback[0].feature_schema_version, 2);
	assert.equal(feedback[0].policy_version, 3);
	assert.equal(feedback[0].model, "jev-test");
	assert.match(feedback[0].created_at, /^\d{4}-\d{2}-\d{2}T/);

	setEmailDisposition(storage, "email-1", "auto-file", "manual");
	assert.equal(
		database.prepare("SELECT COUNT(*) AS count FROM email_triage_feedback WHERE email_id = ?").get("email-1").count,
		2,
	);

	insertEmail(database, "email-2");
	setEmailDisposition(storage, "email-2", "review", "agent");
	assert.equal(
		database.prepare("SELECT COUNT(*) AS count FROM email_triage_feedback WHERE email_id = ?").get("email-2").count,
		0,
	);

	assert.throws(() => setEmailDisposition(storage, "email-1", "hold", "invalid"));
	assert.equal(
		database.prepare("SELECT tag FROM email_tags WHERE email_id = ? AND tag LIKE 'disposition:%'").get("email-1").tag,
		"disposition:auto-file",
	);
	assert.equal(
		database.prepare("SELECT COUNT(*) AS count FROM email_triage_feedback WHERE email_id = ?").get("email-1").count,
		2,
	);

	database.prepare("DELETE FROM emails WHERE id = ?").run("email-1");
	assert.equal(database.prepare("SELECT COUNT(*) AS count FROM email_triage_feedback").get().count, 0);
	database.close();
});

test("keeps manual disposition authoritative when re-analysis changes the prediction", () => {
	const { database, storage } = createDatabase();
	insertEmail(database, "email-1");
	applyEmailTriageResult(storage, "email-1", {
		model: "jev-before",
		features,
		schemaVersion: 1,
		policyVersion: 1,
		predictedDisposition: "review",
	});

	setEmailDisposition(storage, "email-1", "action-required", "manual");
	const result = applyEmailTriageResult(storage, "email-1", {
		model: "jev-after",
		features,
		schemaVersion: 2,
		policyVersion: 3,
		predictedDisposition: "auto-file",
	});

	assert.deepEqual(result, {
		dispositionApplied: false,
		manualDispositionPreserved: true,
	});
	const tag = database.prepare(
		"SELECT tag, provenance FROM email_tags WHERE email_id = ? AND tag LIKE 'disposition:%'",
	).get("email-1") as any;
	assert.equal(tag.tag, "disposition:action-required");
	assert.equal(tag.provenance, "manual");
	assert.equal(
		database.prepare("SELECT predicted_disposition FROM email_triage_analysis WHERE email_id = ?").get("email-1").predicted_disposition,
		"auto-file",
	);
	assert.equal(database.prepare("SELECT COUNT(*) AS count FROM email_triage_feedback").get().count, 1);
	database.close();
});

test("adds feedback migration without losing existing triage data", () => {
	const feedbackMigrationIndex = mailboxMigrations.findIndex(({ name }) => name === "13_add_email_triage_feedback");
	assert.ok(feedbackMigrationIndex >= 0);
	const { database, storage } = createDatabase(mailboxMigrations.slice(0, feedbackMigrationIndex));
	insertEmail(database, "email-existing");
	insertAnalysis(database, "email-existing");

	applyMigrations(storage.sql, mailboxMigrations, storage);

	assert.equal(
		database.prepare("SELECT subject FROM emails WHERE id = ?").get("email-existing").subject,
		"Subject",
	);
	assert.equal(
		database.prepare("SELECT model FROM email_triage_analysis WHERE email_id = ?").get("email-existing").model,
		"jev-test",
	);
	database.close();
});
