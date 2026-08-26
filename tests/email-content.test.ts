import assert from "node:assert/strict";
import { test } from "node:test";
import { createEmailSnippet, stripHtmlToText } from "../workers/lib/email-content.ts";

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
	assert.equal(stripHtmlToText('<p title="1 > 0">Hello</p>'), "Hello");
	assert.equal(stripHtmlToText("<script>alert(1)</script ><style>.hidden{}</style ><p>Safe</p>"), "Safe");
	assert.equal(stripHtmlToText("<!-- note: 2 > 1 --><p>Hello</p>"), "Hello");
	assert.equal(stripHtmlToText("<p>Use 2 < 3 and 5 > 4</p>"), "Use 2 < 3 and 5 > 4");
	assert.equal(stripHtmlToText("<p>Total</p> 2 < 3"), "Total 2 < 3");
	assert.equal(stripHtmlToText("<p>Inter<strong>nation</strong>al</p>"), "International");
	assert.equal(stripHtmlToText("<p><span>Hello</span>, world</p>"), "Hello, world");
	assert.equal(stripHtmlToText("<p>inter<wbr>national <font>mail</font><nobr>box</nobr></p>"), "international mailbox");
	assert.equal(stripHtmlToText("<head><title>Account alert</title></head><body>Actual message</body>"), "Actual message");
	assert.equal(stripHtmlToText("<center>First</center><center>Second</center>"), "First Second");
});

test("does not split a Unicode code point at the snippet boundary", () => {
	assert.equal(createEmailSnippet("x".repeat(299) + "😀z"), "x".repeat(299) + "😀");
});
