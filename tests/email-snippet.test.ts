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

test("preserves angle brackets in plain text and decodes HTML entities", () => {
	assert.equal(
		createEmailSnippet("Use x < y and Email <foo@example.com> now"),
		"Use x < y and Email <foo@example.com> now",
	);
	assert.equal(createEmailSnippet("<p>A&nbsp;&amp;&nbsp;B</p>"), "A & B");
	assert.equal(createEmailSnippet("Show &lt;b&gt; literally"), "Show &lt;b&gt; literally");
	assert.equal(createEmailSnippet("<strong>Hello</strong><blockquote>Quoted</blockquote>"), "Hello Quoted");
	assert.equal(createEmailSnippet("<p>Hello<p>World"), "Hello World");
	assert.equal(createEmailSnippet("<p>&copy; &mdash; &rsquo; &hellip;</p>"), "© — ’ …");
	assert.equal(createEmailSnippet('<p title="1 > 0">Hello</p>'), "Hello");
	assert.equal(createEmailSnippet("<script>alert(1)</script ><style>.hidden{}</style ><p>Safe</p>"), "Safe");
	assert.equal(createEmailSnippet("<!-- note: 2 > 1 --><p>Hello</p>"), "Hello");
	assert.equal(createEmailSnippet("<p>Use 2 < 3 and 5 > 4</p>"), "Use 2 < 3 and 5 > 4");
	assert.equal(createEmailSnippet("<p>Total</p> 2 < 3"), "Total 2 < 3");
	assert.equal(createEmailSnippet("<p>Inter<strong>nation</strong>al</p>"), "International");
	assert.equal(createEmailSnippet("<p><span>Hello</span>, world</p>"), "Hello, world");
	assert.equal(createEmailSnippet("<p>inter<wbr>national <font>mail</font><nobr>box</nobr></p>"), "international mailbox");
	assert.equal(createEmailSnippet("<head><title>Account alert</title></head><body>Actual message</body>"), "Actual message");
	assert.equal(createEmailSnippet("<head><title>Alert</title><body>Actual message</body>"), "Actual message");
	assert.equal(createEmailSnippet("<head><meta charset=\"utf-8\"><p>Actual message</p>"), "Actual message");
	assert.equal(createEmailSnippet("<p>Visible</p><!-- hidden"), "Visible");
	assert.equal(createEmailSnippet("<center>First</center><center>Second</center>"), "First Second");
	assert.equal(createEmailSnippet("<script>hidden</script/><p>Safe</p>"), "Safe");
	assert.equal(createEmailSnippet("<script>hidden</script ignored><p>Safe</p>"), "Safe");
	assert.equal(createEmailSnippet("<img alt=\"Payment failed\">"), "Payment failed");
	assert.equal(
		createEmailSnippet('<img data-alt="Wrong" title="alt=Also wrong" alt="Payment failed">'),
		"Payment failed",
	);
	assert.equal(createEmailSnippet("1 <2 and 3 > 0"), "1 <2 and 3 > 0");
	assert.equal(createEmailSnippet("<head><template><div>Hidden</div></template></head><body>Visible</body>"), "Visible");
	assert.equal(createEmailSnippet("<template>outer<template>inner</template>still hidden</template><p>Visible</p>"), "Visible");
	assert.equal(createEmailSnippet("<p>Hello</p/><p>World</p>"), "Hello World");
});

test("does not split a Unicode code point at the snippet boundary", () => {
	const snippet = createEmailSnippet("x".repeat(299) + "😀z");

	assert.equal(snippet, "x".repeat(299) + "😀");
});

test("keeps plain-text snippets readable and truncates normalized text", () => {
	const snippet = createEmailSnippet("  Plain   text  " + "x".repeat(400));

	assert.equal(snippet.length, 300);
	assert.equal(snippet, "Plain text " + "x".repeat(289));
});
