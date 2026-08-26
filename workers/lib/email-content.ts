// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/** Strip HTML and normalize whitespace to produce readable plain text. */
export function stripHtmlToText(html: string): string {
	if (!html) return "";
	return html
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** Normalize stored body content before exposing it as a list snippet. */
export function createEmailSnippet(body: string | null | undefined): string {
	return stripHtmlToText(body ?? "").slice(0, 300);
}
