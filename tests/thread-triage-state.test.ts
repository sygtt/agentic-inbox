import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import {
	THREAD_TRIAGE_ERROR_AGGREGATE_SQL,
	THREAD_TRIAGE_ERROR_JOIN_SQL,
} from "../workers/durableObject/thread-triage.ts";

test("aggregates a failed older email into its conversation row without changing per-email tags", () => {
	const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as any;
	const database = new DatabaseSync(":memory:");
	database.exec(`
		CREATE TABLE all_emails_with_conversation (
			id TEXT PRIMARY KEY,
			conversation_id TEXT NOT NULL
		);
		CREATE TABLE email_tags (
			email_id TEXT NOT NULL,
			tag TEXT NOT NULL,
			provenance TEXT NOT NULL,
			PRIMARY KEY (email_id, tag)
		);
		CREATE TABLE email_triage_failures (email_id TEXT PRIMARY KEY);
		INSERT INTO all_emails_with_conversation VALUES
			('older-failed', 'conversation-1'),
			('newer-successful', 'conversation-1'),
			('clean-email', 'conversation-2');
		INSERT INTO email_triage_failures VALUES ('older-failed');
		INSERT INTO email_tags VALUES ('clean-email', 'triage:error', 'manual');
	`);

	const rows = database.prepare(`
		SELECT conversation_id, ${THREAD_TRIAGE_ERROR_AGGREGATE_SQL}
		FROM all_emails_with_conversation
		${THREAD_TRIAGE_ERROR_JOIN_SQL}
		GROUP BY conversation_id
		ORDER BY conversation_id
	`).all().map(({ conversation_id, has_triage_error }: any) => ({
		conversation_id,
		has_triage_error,
	}));
	assert.deepEqual(rows, [
		{ conversation_id: "conversation-1", has_triage_error: 1 },
		{ conversation_id: "conversation-2", has_triage_error: 0 },
	]);

	const representativeTags = database.prepare(
		"SELECT tag FROM email_tags WHERE email_id = ?",
	).all("newer-successful");
	assert.deepEqual(representativeTags, []);
	const legacyUserTag = database.prepare(
		"SELECT tag, provenance FROM email_tags WHERE email_id = ?",
	).get("clean-email");
	assert.deepEqual({ ...legacyUserTag }, { tag: "triage:error", provenance: "manual" });
	database.close();
});
