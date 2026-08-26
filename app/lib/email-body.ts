// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,!?;:)\]}]+$/;

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/** Convert plain-text URLs into safe HTTPS/HTTP links without trusting input HTML. */
export function linkifyPlainText(text: string): string {
	const normalized = text.replace(/\r\n?/g, "\n");
	let html = "";
	let lastIndex = 0;

	for (const match of normalized.matchAll(URL_PATTERN)) {
		const rawUrl = match[0];
		const start = match.index ?? 0;
		const url = rawUrl.replace(TRAILING_PUNCTUATION, "");
		html += escapeHtml(normalized.slice(lastIndex, start));
		html += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
		html += escapeHtml(rawUrl.slice(url.length));
		lastIndex = start + rawUrl.length;
	}

	return `${html}${escapeHtml(normalized.slice(lastIndex))}`
		.replace(/\n/g, "<br>");
}

const HTML_TAG_PATTERN = /<\/?(?:a|body|blockquote|br|div|head|h[1-6]|hr|html|img|li|ol|p|pre|script|span|style|table|tbody|td|th|title|tr|ul)(?:\s[^>]*)?>/i;

export function prepareEmailBody(body: string): string {
	return HTML_TAG_PATTERN.test(body) ? body : linkifyPlainText(body);
}
