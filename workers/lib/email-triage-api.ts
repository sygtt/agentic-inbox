// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { Context, Hono } from "hono";
import type { MailboxContext } from "./mailbox.ts";

type AppContext = Context<MailboxContext>;

export function registerEmailTriageRoutes(app: Hono<MailboxContext>) {
	app.get("/api/v1/mailboxes/:mailboxId/emails/:id/triage", async (c: AppContext) => {
		const result = await c.var.mailboxStub.getEmailTriageAnalysis(c.req.param("id")!);
		if (!result.emailExists) return c.json({ error: "Email not found" }, 404);
		return c.json(result.analysis);
	});
}
