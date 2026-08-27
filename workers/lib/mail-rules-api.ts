// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { Context, Hono } from "hono";
import type { MailboxContext } from "./mailbox.ts";
import {
	MailRuleIdSchema,
	MailRuleEnabledSchema,
	MailRuleInputSchema,
	MailRuleReorderRequestSchema,
	type MailRuleMutationResult,
	readMailboxRules,
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

export function registerMailRuleRoutes(app: Hono<MailboxContext>) {
	app.get("/api/v1/mailboxes/:mailboxId/rules", async (c: AppContext) => {
		const result = await loadRules(c);
		return isResponse(result) ? result : c.json(result.rules);
	});

	app.post("/api/v1/mailboxes/:mailboxId/rules", async (c: AppContext) => {
		const parsed = MailRuleInputSchema.safeParse(await readJson(c));
		if (!parsed.success) return c.json({ error: "Invalid mail rule" }, 400);
		const rule = { id: crypto.randomUUID(), ...parsed.data };
		const result = await c.var.mailboxStub.mutateMailRules(c.req.param("mailboxId")!, { operation: "create", rule });
		return mutationResponse(c, result, rule);
	});

	app.put("/api/v1/mailboxes/:mailboxId/rules/reorder", async (c: AppContext) => {
		const parsed = MailRuleReorderRequestSchema.safeParse(await readJson(c));
		if (!parsed.success) return c.json({ error: "Invalid rule order" }, 400);

		const result = await c.var.mailboxStub.mutateMailRules(c.req.param("mailboxId")!, { operation: "reorder", ruleIds: parsed.data.ruleIds });
		if (result.kind === "not-found") return c.json({ error: "Mailbox not found" }, 404);
		if (result.kind === "invalid-order") return c.json({ error: "Rule order must contain every rule exactly once" }, 400);
		return result.kind === "reordered" ? c.json(result.rules) : c.json({ error: "Unable to update mail rules" }, 500);
	});

	app.put("/api/v1/mailboxes/:mailboxId/rules/:id", async (c: AppContext) => {
		const id = MailRuleIdSchema.safeParse(c.req.param("id"));
		const parsed = MailRuleInputSchema.safeParse(await readJson(c));
		if (!id.success || !parsed.success) return c.json({ error: "Invalid mail rule" }, 400);
		const rule = { id: id.data, ...parsed.data };
		const result = await c.var.mailboxStub.mutateMailRules(c.req.param("mailboxId")!, { operation: "update", rule });
		return mutationResponse(c, result, rule);
	});

	app.patch("/api/v1/mailboxes/:mailboxId/rules/:id", async (c: AppContext) => {
		const id = MailRuleIdSchema.safeParse(c.req.param("id"));
		const parsed = MailRuleEnabledSchema.safeParse(await readJson(c));
		if (!id.success || !parsed.success) return c.json({ error: "Invalid mail rule state" }, 400);

		const result = await c.var.mailboxStub.setMailRuleEnabled(
			c.req.param("mailboxId")!,
			id.data,
			parsed.data.enabled,
		);
		if (result.kind === "not-found") return c.json({ error: "Rule not found" }, 404);
		if (result.kind === "invalid-folder") return c.json({ error: "Folder not found" }, 400);
		return result.kind === "updated" ? c.json(result.rule) : c.json({ error: "Unable to update mail rule" }, 500);
	});

	app.delete("/api/v1/mailboxes/:mailboxId/rules/:id", async (c: AppContext) => {
		const id = MailRuleIdSchema.safeParse(c.req.param("id"));
		if (!id.success) return c.json({ error: "Invalid rule ID" }, 400);

		const result = await c.var.mailboxStub.deleteMailRule(c.req.param("mailboxId")!, id.data);
		return result.kind === "not-found" ? c.json({ error: "Rule not found" }, 404) : c.body(null, 204);
	});
}

function mutationResponse(
	c: AppContext,
	result: MailRuleMutationResult,
	rule: unknown,
) {
	if (result.kind === "not-found") return c.json({ error: "Rule not found" }, 404);
	if (result.kind === "invalid-folder") return c.json({ error: "Folder not found" }, 400);
	if (result.kind === "limit-exceeded") return c.json({ error: "Maximum of 100 rules allowed" }, 400);
	if (result.kind === "created" || result.kind === "updated") return c.json(rule, result.kind === "created" ? 201 : 200);
	return c.json({ error: "Unable to update mail rules" }, 500);
}
