import assert from "node:assert/strict";
import { test } from "node:test";
import {
	addMcpEmailTags,
	setMcpEmailDisposition,
	toMcpEmailContent,
} from "../workers/lib/mcp-email.ts";

test("uses readable text as the MCP email body and retains raw HTML explicitly", () => {
	const result = toMcpEmailContent({
		id: "email-1",
		body: "<p>Readable message</p>",
		body_text: "Readable message",
		body_html: "<p>Readable message</p>",
	});

	assert.equal(result.id, "email-1");
	assert.equal(result.body, "Readable message");
	assert.equal(result.body_text, "Readable message");
	assert.equal(result.body_html, "<p>Readable message</p>");
});

test("maps thread messages without exposing raw content as body", () => {
	const result = toMcpEmailContent({
		id: "email-2",
		body: "<div>Thread message</div>",
		body_text: "Thread message",
	});

	assert.equal(result.body, "Thread message");
	assert.equal(result.body_html, "<div>Thread message</div>");
});

test("adds current folder and tag provenance to MCP email metadata", async () => {
	const calls: string[][] = [];
	const env = {
		MAILBOX: {
			idFromName: (id: string) => id,
			get: () => ({
				getEmailTagsForEmails: async (ids: string[]) => {
					calls.push(ids);
					return {
						"email-1": [{ tag: "service:job", provenance: "rule" }],
						"email-2": [{ tag: "disposition:review", provenance: "agent" }],
					};
				},
			}),
		},
	} as any;

	const result = await addMcpEmailTags(env, "test@example.com", [
		{ id: "email-1", folder_id: "inbox" },
		{ id: "email-2", folder_id: "archive" },
	]);

	assert.deepEqual(calls, [["email-1", "email-2"]]);
	assert.deepEqual(result, [
		{ id: "email-1", folder_id: "inbox", tags: [{ tag: "service:job", provenance: "rule" }] },
		{ id: "email-2", folder_id: "archive", tags: [{ tag: "disposition:review", provenance: "agent" }] },
	]);
});

test("MCP disposition records agent provenance and rejects invalid values before mutation", async () => {
	const calls: unknown[][] = [];
	const env = {
		MAILBOX: {
			idFromName: (id: string) => id,
			get: () => ({
				setEmailDisposition: async (...args: unknown[]) => {
					calls.push(args);
					return { tag: `disposition:${args[1]}`, provenance: args[2] };
				},
			}),
		},
	} as any;

	const invalid = await setMcpEmailDisposition(env, "test@example.com", "email-1", "urgent");
	assert.equal(invalid.error, "Invalid disposition. Expected one of: action-required, review, auto-file, hold");
	assert.deepEqual(calls, []);

	const valid = await setMcpEmailDisposition(env, "test@example.com", "email-1", "review");
	assert.deepEqual(valid, {
		status: "disposition_set",
		emailId: "email-1",
		disposition: "review",
		tag: "disposition:review",
		provenance: "agent",
	});
	assert.deepEqual(calls, [["email-1", "review", "agent"]]);
});
