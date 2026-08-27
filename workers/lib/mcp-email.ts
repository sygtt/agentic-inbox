// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { Env } from "../types";
import { DispositionRequestSchema, DISPOSITION_VALUES } from "./email-tags.ts";

type EmailTag = { tag: string; provenance: string };
type EmailTagReaderStub = {
	getEmailTagsForEmails: (ids: string[]) => Promise<Record<string, EmailTag[]>>;
	setEmailDisposition: (
		id: string,
		value: string,
		provenance: string,
	) => Promise<{ tag: string; provenance: string } | null>;
};

function getEmailTagReader(env: Env, mailboxId: string) {
	return env.MAILBOX.get(env.MAILBOX.idFromName(mailboxId)) as unknown as EmailTagReaderStub;
}

export async function addMcpEmailTags(
	env: Env,
	mailboxId: string,
	emails: Record<string, unknown>[],
) {
	const ids = emails
		.map((email) => email.id)
		.filter((id): id is string => typeof id === "string");
	if (ids.length === 0) return emails.map((email) => ({ ...email, tags: [] }));

	const stub = getEmailTagReader(env, mailboxId);
	const tagsByEmail = await stub.getEmailTagsForEmails(ids);
	return emails.map((email) => ({
		...email,
		tags: typeof email.id === "string" ? tagsByEmail[email.id] ?? [] : [],
	}));
}

export async function setMcpEmailDisposition(
	env: Env,
	mailboxId: string,
	emailId: string,
	disposition: string,
) {
	const parsed = DispositionRequestSchema.safeParse({ value: disposition, provenance: "agent" });
	if (!parsed.success) {
		return {
			error: `Invalid disposition. Expected one of: ${DISPOSITION_VALUES.join(", ")}`,
			emailId,
		};
	}

	const result = await getEmailTagReader(env, mailboxId).setEmailDisposition(
		emailId,
		parsed.data.value,
		"agent",
	);
	if (!result) return { error: "Email not found", emailId };
	return {
		status: "disposition_set",
		emailId,
		disposition: parsed.data.value,
		...result,
	};
}

/**
 * Present an email with readable text as the canonical MCP body.
 * The raw stored representation is retained only under body_html.
 */
export function toMcpEmailContent(email: Record<string, unknown>) {
	const { body, body_text, body_html, ...metadata } = email;
	const text = typeof body_text === "string" ? body_text : "";

	return {
		...metadata,
		body: text,
		body_text: text,
		body_html: body_html ?? body ?? null,
	};
}
