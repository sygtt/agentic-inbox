import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { Hono } from "hono";
import { applyMigrations, mailboxMigrations } from "../workers/durableObject/migrations.ts";
import { requireMailbox } from "../workers/lib/mailbox.ts";
import { registerEmailTagRoutes } from "../workers/lib/email-tags-api.ts";
import {
	TagSchema,
	TagProvenanceSchema,
	DispositionRequestSchema,
} from "../workers/lib/email-tags.ts";

test("validates namespaced tags and constrained provenance", () => {
	assert.equal(TagSchema.parse(" Service:Example-Job-Board "), "service:example-job-board");
	assert.equal(TagProvenanceSchema.parse("agent"), "agent");
	assert.throws(() => TagSchema.parse("not-namespaced"));
	assert.throws(() => TagSchema.parse("disposition:"));
	assert.throws(() => TagProvenanceSchema.parse("automation"));
	assert.throws(() => DispositionRequestSchema.parse({ value: "urgent", provenance: "manual" }));
});

test("adds the email-tags migration without changing earlier migrations", () => {
	const migration = mailboxMigrations.find(({ name }) => name === "10_add_email_tags");
	assert.ok(migration);
	assert.match(migration.sql, /CREATE TABLE email_tags/i);
	assert.match(migration.sql, /PRIMARY KEY \(email_id, tag\)/i);
	assert.match(migration.sql, /CHECK \(provenance IN \('rule', 'agent', 'manual'\)\)/i);
	assert.match(migration.sql, /FOREIGN KEY\(email_id\) REFERENCES emails\(id\)/i);
	assert.match(migration.sql, /CREATE UNIQUE INDEX idx_email_tags_one_disposition/i);

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

	const tagMigrationIndex = mailboxMigrations.findIndex(({ name }) => name === "10_add_email_tags");
	applyMigrations(sql, mailboxMigrations.slice(0, tagMigrationIndex), storage);
	database.prepare(
		"INSERT INTO emails (id, folder_id, subject, body) VALUES (?, ?, ?, ?)",
	).run("email-existing", "inbox", "Existing message", "Existing body");
	applyMigrations(sql, mailboxMigrations, storage);

	const existingEmail = database.prepare("SELECT subject FROM emails WHERE id = ?").get("email-existing") as any;
	assert.equal(existingEmail.subject, "Existing message");
	database.prepare(
		"INSERT INTO email_tags (email_id, tag, provenance) VALUES (?, ?, ?)",
	).run("email-existing", "source:job-board", "rule");
	database.prepare(
		"INSERT INTO email_tags (email_id, tag, provenance) VALUES (?, ?, ?)",
	).run("email-existing", "disposition:review", "agent");
	assert.throws(() => database.prepare(
		"INSERT INTO email_tags (email_id, tag, provenance) VALUES (?, ?, ?)",
	).run("email-existing", "disposition:hold", "manual"));
	const storedTag = database.prepare(
		"SELECT tag, provenance FROM email_tags WHERE email_id = ? AND tag = ?",
	).get("email-existing", "source:job-board") as any;
	assert.equal(storedTag.tag, "source:job-board");
	assert.equal(storedTag.provenance, "rule");
	database.close();
});

function createApiTestContext() {
	const tags = new Map<string, { tag: string; provenance: string }>();
	const emailIds = new Set(["email-1"]);
	const stub = {
		getEmailTags: async (id: string) =>
			emailIds.has(id)
				? [...tags.values()].sort((a, b) => a.tag.localeCompare(b.tag))
				: null,
		upsertEmailTag: async (id: string, tag: string, provenance: string) => {
			if (!emailIds.has(id)) return null;
			tags.set(tag, { tag, provenance });
			return { tag, provenance };
		},
		removeEmailTag: async (id: string, tag: string) => {
			if (!emailIds.has(id)) return null;
			return tags.delete(tag);
		},
		setEmailDisposition: async (id: string, value: string, provenance: string) => {
			if (!emailIds.has(id)) return null;
			for (const tag of tags.keys()) {
				if (tag.startsWith("disposition:")) tags.delete(tag);
			}
			const tag = `disposition:${value}`;
			tags.set(tag, { tag, provenance });
			return { tag, provenance };
		},
	};
	const env = {
		BUCKET: {
			head: async (key: string) => key === "mailboxes/test@example.com.json" ? {} : null,
		},
		MAILBOX: {
			idFromName: (id: string) => id,
			get: () => stub,
		},
	} as any;
	const api = new Hono<any>();
	api.use("/api/v1/mailboxes/:mailboxId/*", requireMailbox);
	registerEmailTagRoutes(api);

	return (path: string, init?: RequestInit) => api.request(path, init, env);
}

test("supports mailbox-scoped tag CRUD and disposition replacement", async () => {
	const request = createApiTestContext();
	const base = "/api/v1/mailboxes/test@example.com/emails/email-1";

	let response = await request(`${base}/tags`);
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), []);

	response = await request(`${base}/tags`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ tag: "Service:Example-Job-Board", provenance: "manual" }),
	});
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { tag: "service:example-job-board", provenance: "manual" });

	response = await request(`${base}/tags`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ tag: "service:example-job-board", provenance: "agent" }),
	});
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { tag: "service:example-job-board", provenance: "agent" });

	response = await request(`${base}/tags`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ tag: "invalid", provenance: "manual" }),
	});
	assert.equal(response.status, 400);
	response = await request(`${base}/tags`, { method: "PUT", body: "{" });
	assert.equal(response.status, 400);

	response = await request(`${base}/disposition`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ value: "review", provenance: "agent" }),
	});
	assert.equal(response.status, 200);

	response = await request(`${base}/disposition`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ value: "hold", provenance: "manual" }),
	});
	assert.equal(response.status, 200);

	response = await request(`${base}/tags`);
	assert.deepEqual(await response.json(), [
		{ tag: "disposition:hold", provenance: "manual" },
		{ tag: "service:example-job-board", provenance: "agent" },
	]);

	response = await request(`${base}/tags/service:example-job-board`, { method: "DELETE" });
	assert.equal(response.status, 204);
	response = await request(`${base}/tags/service:example-job-board`, { method: "DELETE" });
	assert.equal(response.status, 404);
});
