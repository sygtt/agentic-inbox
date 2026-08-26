import assert from "node:assert/strict";
import { test } from "node:test";
import { stripHtmlToText } from "../workers/lib/email-content.ts";

test("preserves text-only angle brackets and entities", () => {
	assert.equal(
		stripHtmlToText("Contact Alice <alice@example.com> or use 2 < 3"),
		"Contact Alice <alice@example.com> or use 2 < 3",
	);
	assert.equal(stripHtmlToText("Show &lt;b&gt; literally"), "Show &lt;b&gt; literally");
});

test("normalizes HTML fragments and decodes HTML entities", () => {
	assert.equal(
		stripHtmlToText("<strong>Hello</strong><blockquote>A&nbsp;&amp;&nbsp;B</blockquote>"),
		"Hello A & B",
	);
	assert.equal(stripHtmlToText("<script>alert(1)</script><p>Safe</p>"), "Safe");
	assert.equal(stripHtmlToText("<p>Hello<p>World"), "Hello World");
	assert.equal(stripHtmlToText("<p>&copy; &mdash; &rsquo; &hellip;</p>"), "© — ’ …");
});
