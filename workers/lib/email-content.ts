// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

const HTML_TAG_PATTERN = /<!doctype\b|<\/?(?:a|article|body|br|div|footer|h[1-6]|head|header|hr|html|img|li|main|meta|ol|p|pre|section|span|style|table|td|th|title|tr|ul)\b[^>]*>/i;

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

	const text = HTML_TAG_PATTERN.test(body)
		? body
				.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
				.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
				.replace(/<[^>]+>/g, " ")
		: body;

	return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

/** Normalize stored body content before exposing it as a list snippet. */
export function createEmailSnippet(body: string | null | undefined): string {
	return stripHtmlToText(body ?? "").slice(0, 300);
}
