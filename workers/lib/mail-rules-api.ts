// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { Context, Hono } from "hono";
import type { MailboxContext } from "./mailbox.ts";
import {
	MailRuleIdSchema,
	MailRuleInputSchema,
	MailRuleReorderRequestSchema,
	readMailboxRules,
	saveMailboxRules,
} from "./mail-rules.ts";

type AppContext = Context<MailboxContext>;
type ReadRulesResult = NonNullable<Awaited<ReturnType<typeof readMailboxRules>>>;

async function readJson(c: AppContext): Promise<unknown> {
	try {
		return await c.req.json();
	} catch {
		return undefined;
	}
}

async function loadRules(c: AppContext): Promise<ReadRulesResult | Response> {
	try {
		const result = await readMailboxRules(c.env.BUCKET, c.req.param("mailboxId")!);
		return result || c.json({ error: "Mailbox not found" }, 404);
	} catch {
		return c.json({ error: "Stored mail rules are invalid" }, 500);
	}
}

function isResponse(value: ReadRulesResult | Response): value is Response {
	return value instanceof Response;
}

async function folderExists(c: AppContext, folderId: string | undefined): Promise<boolean> {
	if (!folderId) return true;
	const folders = await c.var.mailboxStub.getFolders();
	return folders.some((folder) => folder.id === folderId);
}

export function registerMailRuleRoutes(app: Hono<MailboxContext>) {
	app.get("/api/v1/mailboxes/:mailboxId/rules", async (c: AppContext) => {
		const result = await loadRules(c);
		return isResponse(result) ? result : c.json(result.rules);
	});

	app.post("/api/v1/mailboxes/:mailboxId/rules", async (c: AppContext) => {
		const parsed = MailRuleInputSchema.safeParse(await readJson(c));
		if (!parsed.success) return c.json({ error: "Invalid mail rule" }, 400);
		if (!(await folderExists(c, parsed.data.action.folderId))) {
			return c.json({ error: "Folder not found" }, 400);
		}

		const result = await loadRules(c);
		if (isResponse(result)) return result;
		const rule = { id: crypto.randomUUID(), ...parsed.data };
		const rules = [...result.rules, rule];
		if (!(await saveMailboxRules(c.env.BUCKET, c.req.param("mailboxId")!, rules))) {
			return c.json({ error: "Mailbox not found" }, 404);
		}
		return c.json(rule, 201);
	});

	app.put("/api/v1/mailboxes/:mailboxId/rules/reorder", async (c: AppContext) => {
		const parsed = MailRuleReorderRequestSchema.safeParse(await readJson(c));
		if (!parsed.success) return c.json({ error: "Invalid rule order" }, 400);

		const result = await loadRules(c);
		if (isResponse(result)) return result;
		const currentIds = new Set(result.rules.map((rule) => rule.id));
		const requestedIds = new Set(parsed.data.ruleIds);
		if (
			requestedIds.size !== result.rules.length ||
			requestedIds.size !== parsed.data.ruleIds.length ||
			[...requestedIds].some((id) => !currentIds.has(id))
		) {
			return c.json({ error: "Rule order must contain every rule exactly once" }, 400);
		}

		const rulesById = new Map(result.rules.map((rule) => [rule.id, rule]));
		const rules = parsed.data.ruleIds.map((id) => rulesById.get(id)!);
		await saveMailboxRules(c.env.BUCKET, c.req.param("mailboxId")!, rules);
		return c.json(rules);
	});

	app.put("/api/v1/mailboxes/:mailboxId/rules/:id", async (c: AppContext) => {
		const id = MailRuleIdSchema.safeParse(c.req.param("id"));
		const parsed = MailRuleInputSchema.safeParse(await readJson(c));
		if (!id.success || !parsed.success) return c.json({ error: "Invalid mail rule" }, 400);
		if (!(await folderExists(c, parsed.data.action.folderId))) {
			return c.json({ error: "Folder not found" }, 400);
		}

		const result = await loadRules(c);
		if (isResponse(result)) return result;
		const index = result.rules.findIndex((rule) => rule.id === id.data);
		if (index < 0) return c.json({ error: "Rule not found" }, 404);

		const rule = { id: id.data, ...parsed.data };
		const rules = [...result.rules];
		rules[index] = rule;
		await saveMailboxRules(c.env.BUCKET, c.req.param("mailboxId")!, rules);
		return c.json(rule);
	});

	app.delete("/api/v1/mailboxes/:mailboxId/rules/:id", async (c: AppContext) => {
		const id = MailRuleIdSchema.safeParse(c.req.param("id"));
		if (!id.success) return c.json({ error: "Invalid rule ID" }, 400);

		const result = await loadRules(c);
		if (isResponse(result)) return result;
		if (!result.rules.some((rule) => rule.id === id.data)) {
			return c.json({ error: "Rule not found" }, 404);
		}

		await saveMailboxRules(
			c.env.BUCKET,
			c.req.param("mailboxId")!,
			result.rules.filter((rule) => rule.id !== id.data),
		);
		return c.body(null, 204);
	});
}
