import assert from "node:assert/strict";
import { test } from "node:test";
import { linkifyPlainText, prepareEmailBody } from "../app/lib/email-body.ts";

test("linkifies plain-text HTTP URLs and preserves punctuation outside the link", () => {
	assert.equal(
		linkifyPlainText("Open https://example.com/verify?code=1234."),
		'Open <a href="https://example.com/verify?code=1234" target="_blank" rel="noopener noreferrer">https://example.com/verify?code=1234</a>.',
	);
});

test("preserves balanced closing delimiters in URLs", () => {
	assert.equal(
		linkifyPlainText("Read https://en.wikipedia.org/wiki/Function_(mathematics)."),
		'Read <a href="https://en.wikipedia.org/wiki/Function_(mathematics)" target="_blank" rel="noopener noreferrer">https://en.wikipedia.org/wiki/Function_(mathematics)</a>.',
	);
	assert.equal(
		linkifyPlainText("(https://example.com)"),
		'(<a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>)',
	);
});

test("escapes plain text before linkifying it", () => {
	assert.equal(
		linkifyPlainText("<script>alert(1)</script> https://example.com"),
		'&lt;script&gt;alert(1)&lt;/script&gt; <a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>',
	);
	assert.equal(
		linkifyPlainText("Press <Enter> and visit https://example.com"),
		'Press &lt;Enter&gt; and visit <a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>',
	);
	assert.equal(
		prepareEmailBody("Press <Enter> and visit https://example.com"),
		'Press &lt;Enter&gt; and visit <a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>',
	);
});

test("keeps existing HTML for the normal sanitization path", () => {
	assert.equal(prepareEmailBody("<p>Visit <a href=\"https://example.com\">site</a></p>"), "<p>Visit <a href=\"https://example.com\">site</a></p>");
	assert.equal(prepareEmailBody("<strong>Read https://example.com</strong>"), "<strong>Read https://example.com</strong>");
});
