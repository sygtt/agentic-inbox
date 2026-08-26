// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { decodeHTML } from "entities";

const HTML_CLOSING_TAG_PATTERN = /<\/[a-z][\w:-]*\s*>/i;
const HTML_FRAGMENT_PATTERN = /<!doctype\b|<!--[\s\S]*?-->|<\/?(?:area|base|br|col|colgroup|dd|embed|hr|img|input|li|link|meta|option|param|source|tbody|td|tfoot|th|thead|track|tr|dt|p|rp|rt|wbr)\b[^>]*\/?>/i;

function stripHtmlTags(html: string): string {
	const parts: string[] = [];
	let textStart = 0;
	let tagStart = -1;
	let quote = "";

	for (let i = 0; i < html.length; i++) {
		const char = html[i];
		if (tagStart === -1) {
			if (char === "<") {
				parts.push(html.slice(textStart, i));
				tagStart = i;
			}
			continue;
		}

		if (quote) {
			if (char === quote) quote = "";
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (char === ">") {
			parts.push(" ");
			tagStart = -1;
			textStart = i + 1;
		}
	}

	parts.push(html.slice(textStart));
	return parts.join("");
}

/** Strip HTML and normalize whitespace to produce readable plain text. */
export function stripHtmlToText(body: string): string {
	if (!body) return "";

	// ponytail: without a persisted MIME marker, paired/void-tag detection is
	// the smallest safe discriminator; ambiguous paired prose is the ceiling.
	const isHtml = HTML_CLOSING_TAG_PATTERN.test(body) || HTML_FRAGMENT_PATTERN.test(body);
	const text = isHtml
		? stripHtmlTags(
				body
					.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
					.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ""),
			)
		: body;

	return (isHtml ? decodeHTML(text) : text).replace(/\s+/g, " ").trim();
}

function truncateToCodePoints(text: string, limit: number): string {
	let end = 0;
	let count = 0;
	for (const codePoint of text) {
		if (count === limit) break;
		end += codePoint.length;
		count++;
	}
	return text.slice(0, end);
}

/** Normalize stored body content before exposing it as a list snippet. */
export function createEmailSnippet(body: string | null | undefined): string {
	return truncateToCodePoints(stripHtmlToText(body ?? ""), 300);
}
