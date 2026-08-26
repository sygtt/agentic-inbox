// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

const PAIRED_HTML_TAG_PATTERN = /<([a-z][\w:-]*)\b[^>]*>[\s\S]*?<\/\1\s*>/i;
const HTML_FRAGMENT_PATTERN = /<!doctype\b|<!--[\s\S]*?-->|<\/?(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b[^>]*\/?>/i;

const HTML_ENTITIES: Record<string, string> = {
	amp: "&",
	apos: "'",
	gt: ">",
	lt: "<",
	nbsp: " ",
	quot: '"',
};

function decodeHtmlEntities(text: string): string {
	return text.replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/gi, (entity, value: string) => {
		if (value.toLowerCase().startsWith("#x")) {
			const codePoint = Number.parseInt(value.slice(2), 16);
			return codePoint >= 0 && codePoint <= 0x10ffff
				? String.fromCodePoint(codePoint)
				: entity;
		}
		if (value.startsWith("#")) {
			const codePoint = Number.parseInt(value.slice(1), 10);
			return codePoint >= 0 && codePoint <= 0x10ffff
				? String.fromCodePoint(codePoint)
				: entity;
		}
		return HTML_ENTITIES[value.toLowerCase()] ?? entity;
	});
}

/** Strip HTML and normalize whitespace to produce readable plain text. */
export function stripHtmlToText(body: string): string {
	if (!body) return "";

	// ponytail: without a persisted MIME marker, paired/void-tag detection is
	// the smallest safe discriminator; ambiguous paired prose is the ceiling.
	const isHtml = PAIRED_HTML_TAG_PATTERN.test(body) || HTML_FRAGMENT_PATTERN.test(body);
	const text = isHtml
		? body
				.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
				.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
				.replace(/<[^>]+>/g, " ")
		: body;

	return (isHtml ? decodeHtmlEntities(text) : text).replace(/\s+/g, " ").trim();
}

/** Normalize stored body content before exposing it as a list snippet. */
export function createEmailSnippet(body: string | null | undefined): string {
	return stripHtmlToText(body ?? "").slice(0, 300);
}
