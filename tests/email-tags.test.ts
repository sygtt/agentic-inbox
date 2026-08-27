import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { mailboxMigrations } from "../workers/durableObject/migrations.ts";
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
