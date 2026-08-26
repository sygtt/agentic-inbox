// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { decodeHTML } from "entities";

const PAIRED_HTML_TAG_PATTERN = /<([a-z][\w:-]*)\b[^>]*>[\s\S]*?<\/\1\s*>/i;
const HTML_FRAGMENT_PATTERN = /<!doctype\b|<!--[\s\S]*?-->|<\/?(?:area|base|br|col|colgroup|dd|embed|hr|img|input|li|link|meta|option|param|source|tbody|td|tfoot|th|thead|track|tr|dt|p|rp|rt|wbr)\b[^>]*\/?>/i;

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

	return (isHtml ? decodeHTML(text) : text).replace(/\s+/g, " ").trim();
}

/** Normalize stored body content before exposing it as a list snippet. */
export function createEmailSnippet(body: string | null | undefined): string {
	return stripHtmlToText(body ?? "").slice(0, 300);
}
