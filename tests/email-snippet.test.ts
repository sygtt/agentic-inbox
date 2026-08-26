import assert from "node:assert/strict";
import { test } from "node:test";
import { createEmailSnippet } from "../workers/lib/email-content.ts";

test("normalizes HTML before truncating an email snippet", () => {
	const snippet = createEmailSnippet(
		"<!DOCTYPE html><html><head><style>.hidden{display:none}</style></head><body><p>Readable message</p><script>alert(1)</script></body></html>",
	);

	assert.equal(snippet, "Readable message");
	assert.ok(!/<!(?:DOCTYPE)|<(?:html|head|style|script)\b/i.test(snippet));
});

test("keeps plain-text snippets readable and truncates normalized text", () => {
	const snippet = createEmailSnippet("  Plain   text  " + "x".repeat(400));

	assert.equal(snippet.length, 300);
	assert.equal(snippet, "Plain text " + "x".repeat(289));
});
