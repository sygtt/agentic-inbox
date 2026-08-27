import assert from "node:assert/strict";
import { test } from "node:test";
import { toMcpEmailContent } from "../workers/lib/mcp-email.ts";

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
