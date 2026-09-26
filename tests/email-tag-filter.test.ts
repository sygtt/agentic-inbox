import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { AVAILABLE_EMAIL_TAGS_SQL, emailTagExistsSql } from "../workers/lib/email-tag-filter.ts";

test("exact tag filtering matches any provenance and keeps paged counts accurate", () => {
	const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as any;
	const database = new DatabaseSync(":memory:");
	database.exec(`
		CREATE TABLE emails (id TEXT PRIMARY KEY, date TEXT NOT NULL);
		CREATE TABLE email_tags (email_id TEXT NOT NULL, tag TEXT NOT NULL, provenance TEXT NOT NULL);
		CREATE TABLE email_triage_failures (email_id TEXT PRIMARY KEY, failed_at TEXT NOT NULL);
		INSERT INTO emails VALUES ('email-1', '2026-01-03'), ('email-2', '2026-01-02'), ('email-3', '2026-01-01');
		INSERT INTO email_tags VALUES
			('email-1', 'disposition:review', 'agent'),
			('email-1', 'project:lab', 'manual'),
			('email-2', 'disposition:review', 'manual'),
			('email-3', 'project:lab', 'rule');
		INSERT INTO email_triage_failures VALUES ('email-3', '2026-01-01T00:00:00Z');
	`);

	const tagClause = emailTagExistsSql("emails.id", "?1");
	const page = database.prepare(`SELECT id FROM emails WHERE ${tagClause} ORDER BY date DESC LIMIT ?2 OFFSET ?3`);
	const count = database.prepare(`SELECT COUNT(*) AS total FROM emails WHERE ${tagClause}`);

	assert.deepEqual(page.all("disposition:review", 1, 1).map((row: { id: string }) => row.id), ["email-2"]);
	assert.equal(count.get("disposition:review").total, 2);
	assert.deepEqual(page.all("project:lab", 10, 0).map((row: { id: string }) => row.id), ["email-1", "email-3"]);
	assert.deepEqual(page.all("triage:error", 10, 0).map((row: { id: string }) => row.id), ["email-3"]);
	assert.equal(count.get("triage:error").total, 1);
	assert.ok(database.prepare(AVAILABLE_EMAIL_TAGS_SQL).all("triage:error").some((row: { tag: string }) => row.tag === "triage:error"));
	database.prepare("DELETE FROM email_triage_failures").run();
	assert.ok(!database.prepare(AVAILABLE_EMAIL_TAGS_SQL).all("triage:error").some((row: { tag: string }) => row.tag === "triage:error"));
	database.close();
});

test("thread tag filtering keeps the current conversation row when an older message matches", () => {
	const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as any;
	const database = new DatabaseSync(":memory:");
	database.exec(`
		CREATE TABLE emails (id TEXT PRIMARY KEY, folder_id TEXT NOT NULL, thread_id TEXT, date TEXT NOT NULL);
		CREATE TABLE email_tags (email_id TEXT NOT NULL, tag TEXT NOT NULL, provenance TEXT NOT NULL);
		CREATE TABLE email_triage_failures (email_id TEXT PRIMARY KEY, failed_at TEXT NOT NULL);
		INSERT INTO emails VALUES
			('thread-a-old', 'inbox', 'thread-a', '2026-01-01'),
			('thread-a-new', 'inbox', 'thread-a', '2026-01-03'),
			('thread-b-only', 'inbox', 'thread-b', '2026-01-02');
		INSERT INTO email_tags VALUES ('thread-a-old', 'project:lab', 'manual');
	`);

	const query = `WITH
		folder_emails AS (
			SELECT id, thread_id, COALESCE(thread_id, id) AS raw_thread_id, date
			FROM emails WHERE folder_id = 'inbox'
		),
		thread_to_conversation AS (
			SELECT raw_thread_id, raw_thread_id AS conversation_id FROM folder_emails
		),
		matching_tag_conversations AS (
			SELECT DISTINCT COALESCE(tc.conversation_id, fe.raw_thread_id) AS conversation_id
			FROM folder_emails fe
			LEFT JOIN thread_to_conversation tc ON fe.raw_thread_id = tc.raw_thread_id
			WHERE ?2 IS NOT NULL AND ${emailTagExistsSql("fe.id", "?2")}
		),
		latest_in_folder AS (
			SELECT fe.*, COALESCE(tc.conversation_id, fe.raw_thread_id) AS conversation_id,
				ROW_NUMBER() OVER (PARTITION BY COALESCE(tc.conversation_id, fe.raw_thread_id) ORDER BY fe.date DESC) AS rn
			FROM folder_emails fe
			LEFT JOIN thread_to_conversation tc ON fe.raw_thread_id = tc.raw_thread_id
		)
		SELECT id FROM latest_in_folder
		WHERE rn = 1 AND (?2 IS NULL OR conversation_id IN (SELECT conversation_id FROM matching_tag_conversations))
		ORDER BY date DESC LIMIT ?1`;

	assert.deepEqual(database.prepare(query).all(10, "project:lab").map((row: { id: string }) => row.id), ["thread-a-new"]);
	assert.deepEqual(database.prepare(query).all(10, "service:missing"), []);
	database.close();
});
