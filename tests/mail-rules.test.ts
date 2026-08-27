import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { requireMailbox } from "../workers/lib/mailbox.ts";
import { registerMailRuleRoutes } from "../workers/lib/mail-rules-api.ts";
import {
	evaluateMailRules,
	MailRuleInputSchema,
	MailRuleListSchema,
	readMailboxRules,
} from "../workers/lib/mail-rules.ts";

const firstRule = {
	id: "11111111-1111-4111-8111-111111111111",
	conditions: {
		envelopeRecipient: "alias@example.com",
		senderDomain: "Example.NET",
		subjectContains: "Job offer",
	},
	action: { folderId: "career", tags: ["Source:Job-Board"] },
};

const laterRule = {
	id: "22222222-2222-4222-8222-222222222222",
	conditions: { senderDomain: "example.net" },
	action: { folderId: "inbox" },
};

test("validates and evaluates ordered rules with AND semantics", () => {
	const parsed = MailRuleListSchema.parse([firstRule, laterRule]);
	assert.equal(parsed[0].conditions.senderDomain, "example.net");
	assert.deepEqual(parsed[0].action.tags, ["source:job-board"]);

	const match = evaluateMailRules(parsed, {
		envelopeRecipient: "alias@example.com",
		sender: "recruiter@example.net",
		subject: "A JOB OFFER for you",
	});
	assert.equal(match.invalid, false);
	assert.equal(match.rule?.id, firstRule.id);

	const noMatch = evaluateMailRules(parsed, {
		envelopeRecipient: "alias@example.com",
		sender: "recruiter@other.net",
		subject: "Newsletter",
	});
	assert.equal(noMatch.rule, null);

	assert.equal(evaluateMailRules("invalid", {
		envelopeRecipient: "alias@example.com",
		sender: "recruiter@example.net",
		subject: "A JOB OFFER for you",
	}).invalid, true);
	assert.equal(MailRuleInputSchema.safeParse({
		conditions: {},
		action: { folderId: "career" },
	}).success, false);
	assert.equal(MailRuleInputSchema.safeParse({
		conditions: { sender: "person@example.net" },
		action: { tags: ["disposition:review"] },
	}).success, false);
});

test("rejects malformed rules stored in mailbox settings", async () => {
	const bucket = {
		get: async () => ({
			json: async () => ({ rules: [{ ...firstRule, action: { tags: ["not-namespaced"] } }] }),
		}),
	} as any;
	await assert.rejects(
		() => readMailboxRules(bucket, "test@example.com"),
		/Invalid mail rules/,
	);
});

function createApiTestContext() {
	let settings: Record<string, unknown> = { fromName: "Test", rules: [] };
	const stub = {
		getFolders: async () => [
			{ id: "inbox", name: "Inbox", unreadCount: 0 },
			{ id: "career", name: "Career", unreadCount: 0 },
		],
	};
	const env = {
		BUCKET: {
			head: async (key: string) => key === "mailboxes/test@example.com.json" ? {} : null,
			get: async (key: string) => key === "mailboxes/test@example.com.json"
				? { json: async <T>() => settings as T }
				: null,
			put: async (_key: string, value: string) => { settings = JSON.parse(value); },
		},
		MAILBOX: {
			idFromName: (id: string) => id,
			get: () => stub,
		},
	} as any;
	const api = new Hono<any>();
	api.use("/api/v1/mailboxes/:mailboxId/*", requireMailbox);
	registerMailRuleRoutes(api);

	return (path: string, init?: RequestInit) => api.request(path, init, env);
}

test("supports authenticated mailbox-scoped rule CRUD and reorder", async () => {
	const request = createApiTestContext();
	const base = "/api/v1/mailboxes/test@example.com/rules";

	let response = await request(base, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(firstRule),
	});
	assert.equal(response.status, 400);

	response = await request(base, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ conditions: firstRule.conditions, action: firstRule.action }),
	});
	assert.equal(response.status, 201);
	const created = await response.json() as typeof firstRule;
	assert.match(created.id, /^[0-9a-f-]{36}$/);
	assert.deepEqual(created.action.tags, ["source:job-board"]);

	response = await request(base, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			conditions: { sender: "person@example.net" },
			action: { tags: ["source:newsletter"] },
		}),
	});
	assert.equal(response.status, 201);
	const second = await response.json() as typeof firstRule;

	response = await request("/api/v1/mailboxes/missing@example.com/rules");
	assert.equal(response.status, 404);

	response = await request(`${base}/reorder`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ruleIds: [second.id, created.id] }),
	});
	assert.equal(response.status, 200);
	response = await request(`${base}/reorder`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ruleIds: [created.id] }),
	});
	assert.equal(response.status, 400);

	response = await request(base);
	assert.deepEqual((await response.json() as Array<{ id: string }>).map((rule) => rule.id), [second.id, created.id]);

	response = await request(`${base}/${created.id}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			conditions: { sender: "updated@example.net" },
			action: { folderId: "missing" },
		}),
	});
	assert.equal(response.status, 400);

	response = await request(`${base}/${created.id}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			conditions: { sender: "updated@example.net" },
			action: { folderId: "career" },
		}),
	});
	assert.equal(response.status, 200);

	response = await request(`${base}/${created.id}`, { method: "DELETE" });
	assert.equal(response.status, 204);
	response = await request(`${base}/${created.id}`, { method: "DELETE" });
	assert.equal(response.status, 404);
});
