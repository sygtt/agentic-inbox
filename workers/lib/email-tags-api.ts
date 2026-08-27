// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { Context, Hono } from "hono";
import type { MailboxContext } from "./mailbox.ts";
import {
	TagSchema,
	TagAssignmentRequestSchema,
	DispositionRequestSchema,
	isDispositionTag,
} from "./email-tags.ts";

type AppContext = Context<MailboxContext>;

async function readJson(c: AppContext): Promise<unknown> {
	try {
		return await c.req.json();
	} catch {
		return undefined;
	}
}

export function registerEmailTagRoutes(app: Hono<MailboxContext>) {
	app.get("/api/v1/mailboxes/:mailboxId/emails/:id/tags", async (c: AppContext) => {
		const tags = await c.var.mailboxStub.getEmailTags(c.req.param("id")!);
		return tags === null ? c.json({ error: "Email not found" }, 404) : c.json(tags);
	});

	app.put("/api/v1/mailboxes/:mailboxId/emails/:id/tags", async (c: AppContext) => {
		const parsed = TagAssignmentRequestSchema.safeParse(await readJson(c));
		if (!parsed.success) return c.json({ error: "Invalid tag or provenance" }, 400);
		if (isDispositionTag(parsed.data.tag)) {
			return c.json({ error: "Use the disposition endpoint for disposition tags" }, 400);
		}

		const result = await c.var.mailboxStub.upsertEmailTag(
			c.req.param("id")!,
			parsed.data.tag,
			parsed.data.provenance,
		);
		return result === null ? c.json({ error: "Email not found" }, 404) : c.json(result);
	});

	app.delete("/api/v1/mailboxes/:mailboxId/emails/:id/tags/:tag", async (c: AppContext) => {
		const parsed = TagSchema.safeParse(c.req.param("tag"));
		if (!parsed.success) return c.json({ error: "Invalid tag" }, 400);

		const result = await c.var.mailboxStub.removeEmailTag(c.req.param("id")!, parsed.data);
		if (result === null) return c.json({ error: "Email not found" }, 404);
		return result ? c.body(null, 204) : c.json({ error: "Tag not found" }, 404);
	});

	app.put("/api/v1/mailboxes/:mailboxId/emails/:id/disposition", async (c: AppContext) => {
		const parsed = DispositionRequestSchema.safeParse(await readJson(c));
		if (!parsed.success) return c.json({ error: "Invalid disposition or provenance" }, 400);

		const result = await c.var.mailboxStub.setEmailDisposition(
			c.req.param("id")!,
			parsed.data.value,
			parsed.data.provenance,
		);
		return result === null ? c.json({ error: "Email not found" }, 404) : c.json(result);
	});
}
