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
	serializeMailboxRules,
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
	assert.equal(match.rule?.enabled, true);
	assert.equal(evaluateMailRules([{ ...firstRule, enabled: false }], {
		envelopeRecipient: "alias@example.com",
		sender: "recruiter@example.net",
		subject: "A JOB OFFER for you",
	}).rule, null);

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
	assert.equal(MailRuleInputSchema.parse({
		conditions: { sender: "person@example.net" },
		action: { tags: ["source:newsletter"] },
	}).enabled, true);
	const tooManyRules = Array.from({ length: 101 }, (_, index) => ({
		...firstRule,
		id: `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
	}));
	assert.equal(MailRuleListSchema.safeParse(tooManyRules).success, false);
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

test("keeps the legacy rules key safe for older workers", () => {
	const settings = serializeMailboxRules({ fromName: "Test" }, [
		{ ...firstRule, enabled: true },
		{ ...laterRule, enabled: false },
	]);
	assert.deepEqual(settings.rules, [{ ...firstRule }]);
	assert.deepEqual(settings.rules_v2, [
		{ ...firstRule, enabled: true },
		{ ...laterRule, enabled: false },
	]);
});

function createApiTestContext(initialRules: unknown[] = []) {
	let settings: Record<string, unknown> = { fromName: "Test", rules: initialRules };
	const stub = {
		getFolders: async () => [
			{ id: "inbox", name: "Inbox", unreadCount: 0 },
			{ id: "career", name: "Career", unreadCount: 0 },
		],
		mutateMailRules: async (_mailboxId: string, mutation: any) => {
			const rules = settings.rules as any[];
			if (mutation.operation === "reorder") {
				const ids = new Set(rules.map((rule) => rule.id));
				const requested = new Set(mutation.ruleIds);
				if (requested.size !== rules.length || requested.size !== mutation.ruleIds.length || [...requested].some((id) => !ids.has(id))) {
					return { kind: "invalid-order" };
				}
				const byId = new Map(rules.map((rule) => [rule.id, rule]));
				const reordered = mutation.ruleIds.map((id: string) => byId.get(id));
				settings = { ...settings, rules: reordered };
				return { kind: "reordered", rules: reordered };
			}
			if (mutation.operation === "create") {
				if (rules.length >= 100) return { kind: "limit-exceeded" };
				if (mutation.rule.action.folderId === "missing") return { kind: "invalid-folder" };
				settings = { ...settings, rules: [...rules, mutation.rule] };
				return { kind: "created", rule: mutation.rule };
			}
			if (mutation.rule.action.folderId === "missing") return { kind: "invalid-folder" };
			const index = rules.findIndex((rule) => rule.id === mutation.rule.id);
			if (index < 0) return { kind: "not-found" };
			const updated = [...rules];
			updated[index] = mutation.rule;
			settings = { ...settings, rules: updated };
			return { kind: "updated", rule: mutation.rule };
		},
		deleteMailRule: async (_mailboxId: string, id: string) => {
			const rules = settings.rules as any[];
			if (!rules.some((rule) => rule.id === id)) return { kind: "not-found" };
			settings = { ...settings, rules: rules.filter((rule) => rule.id !== id) };
			return { kind: "deleted" };
		},
		setMailRuleEnabled: async (_mailboxId: string, id: string, enabled: boolean) => {
			const rules = settings.rules as any[];
			const index = rules.findIndex((rule) => rule.id === id);
			if (index < 0) return { kind: "not-found" };
			const updated = [...rules];
			updated[index] = { ...updated[index], enabled };
			settings = { ...settings, rules: updated };
			return { kind: "updated", rule: updated[index] };
		},
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
	assert.equal(created.enabled, true);
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
			enabled: false,
			conditions: { sender: "updated@example.net" },
			action: { folderId: "career" },
		}),
	});
	assert.equal(response.status, 200);
	assert.equal((await response.json() as { enabled: boolean }).enabled, false);

	response = await request(`${base}/${created.id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ enabled: true }),
	});
	assert.equal(response.status, 200);
	assert.equal((await response.json() as { enabled: boolean }).enabled, true);

	response = await request(`${base}/${created.id}`, { method: "DELETE" });
	assert.equal(response.status, 204);
	response = await request(`${base}/${created.id}`, { method: "DELETE" });
	assert.equal(response.status, 404);

	const fullRequest = createApiTestContext(Array.from({ length: 100 }, (_, index) => ({
		...firstRule,
		id: `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
	})));
	response = await fullRequest(base, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ conditions: { sender: "person@example.net" }, action: { folderId: "career" } }),
	});
	assert.equal(response.status, 400);
});
