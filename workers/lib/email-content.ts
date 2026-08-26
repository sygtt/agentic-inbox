// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { decodeHTML } from "entities";

const HTML_CLOSING_TAG_PATTERN = /<\/[a-z][\w:-]*\s*>/i;
const HTML_FRAGMENT_PATTERN = /<!doctype\b|<!--[\s\S]*?-->|<\/?(?:area|base|br|col|colgroup|dd|embed|hr|img|input|li|link|meta|option|param|source|tbody|td|tfoot|th|thead|track|tr|dt|p|rp|rt|wbr)\b[^>]*\/?>/i;

function findTagEnd(html: string, start: number): number {
	let quote = "";
	for (let i = start; i < html.length; i++) {
		const char = html[i];
		if (quote) {
			if (char === quote) quote = "";
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (char === ">") {
			return i;
		}
	}
	return -1;
}

function isTagNameChar(char: string | undefined): boolean {
	return !!char && /[a-z0-9:-]/i.test(char);
}

function parseHtmlTag(html: string, start: number): { end: number; name: string; closing: boolean } | null {
	if (html[start] !== "<") return null;
	if (html.startsWith("<!--", start)) {
		const end = html.indexOf("-->", start + 4);
		return end === -1 ? null : { end: end + 2, name: "", closing: false };
	}

	let index = start + 1;
	const closing = html[index] === "/";
	if (closing) index++;
	if (html[index] === "!" || html[index] === "?") {
		const end = findTagEnd(html, index);
		return end === -1 ? null : { end, name: "", closing: false };
	}

	const nameStart = index;
	while (isTagNameChar(html[index])) index++;
	if (index === nameStart) return null;
	const next = html[index];
	if (closing ? next !== ">" && !/\s/.test(next || "") : next !== ">" && next !== "/" && !/\s/.test(next || "")) {
		return null;
	}

	const end = findTagEnd(html, index);
	return end === -1 ? null : { end, name: html.slice(nameStart, index).toLowerCase(), closing };
}

function findRawElementClosingTag(html: string, start: number, name: string) {
	for (let index = start; index < html.length; ) {
		const tagStart = html.indexOf("<", index);
		if (tagStart === -1) return null;
		const tag = parseHtmlTag(html, tagStart);
		if (tag?.closing && tag.name === name) return tag;
		index = tagStart + 1;
	}
	return null;
}

function stripHtmlTags(html: string): string {
	const parts: string[] = [];
	let textStart = 0;
	for (let index = 0; index < html.length; ) {
		const tag = parseHtmlTag(html, index);
		if (!tag) {
			index++;
			continue;
		}

		parts.push(html.slice(textStart, index), " ");
		if (!tag.closing && (tag.name === "script" || tag.name === "style")) {
			const closingTag = findRawElementClosingTag(html, tag.end + 1, tag.name);
			if (!closingTag) return parts.join("");
			index = closingTag.end + 1;
			textStart = index;
			continue;
		}
		index = tag.end + 1;
		textStart = index;
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
