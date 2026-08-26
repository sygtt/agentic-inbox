// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { decodeHTML } from "entities";

const INLINE_TAGS = new Set([
	"a", "abbr", "b", "bdi", "bdo", "cite", "code", "data", "del", "em",
	"i", "ins", "kbd", "label", "mark", "q", "s", "samp", "small", "span",
	"strong", "sub", "sup", "time", "u", "var",
]);

function isTagNameChar(char: string | undefined): boolean {
	return !!char && /[a-z0-9:-]/i.test(char);
}

function readTagName(html: string, start: number) {
	if (html[start] !== "<") return null;
	let index = start + 1;
	const closing = html[index] === "/";
	if (closing) index++;
	if (html[index] === "!" || html[index] === "?") {
		return { name: "", closing: false, index };
	}

	const nameStart = index;
	while (isTagNameChar(html[index])) index++;
	if (index === nameStart) return null;
	const next = html[index];
	if (closing ? next !== ">" && !/\s/.test(next || "") : next !== ">" && next !== "/" && !/\s/.test(next || "")) {
		return null;
	}

	return { name: html.slice(nameStart, index).toLowerCase(), closing, index };
}

function getTagInfo(html: string, start: number, end: number) {
	if (html.startsWith("<!--", start)) {
		return html.slice(end - 2, end + 1) === "-->" ? { name: "", closing: false } : null;
	}
	const tag = readTagName(html, start);
	return tag && (tag.index <= end) ? { name: tag.name, closing: tag.closing } : null;
}

function looksLikeHtml(body: string): boolean {
	for (let index = 0; index < body.length; index++) {
		if (body[index] !== "<") continue;
		if (body.startsWith("<!--", index)) return true;
		if (readTagName(body, index)) return true;
	}
	return false;
}

function findRawElementClosingTag(html: string, start: number, name: string) {
	for (let index = start; index < html.length; index++) {
		if (html[index] !== "<" || html[index + 1] !== "/") continue;
		const nameStart = index + 2;
		let nameEnd = nameStart;
		while (isTagNameChar(html[nameEnd])) nameEnd++;
		if (html.slice(nameStart, nameEnd).toLowerCase() !== name) continue;
		let end = nameEnd;
		while (/\s/.test(html[end] || "")) end++;
		if (html[end] === ">") return { end, name, closing: true };
	}
	return null;
}

function stripHtmlTags(html: string): string {
	const parts: string[] = [];
	let textStart = 0;
	let tagStart = -1;
	let comment = false;
	let quote = "";

	for (let index = 0; index < html.length; index++) {
		if (tagStart === -1) {
			if (html[index] !== "<") continue;
			if (html.startsWith("<!--", index)) {
				tagStart = index;
				comment = true;
			} else if (readTagName(html, index)) {
				tagStart = index;
			}
			continue;
		}

		if (comment) {
			if (!html.startsWith("-->", index)) continue;
			parts.push(html.slice(textStart, tagStart), " ");
			index += 2;
			textStart = index + 1;
			tagStart = -1;
			comment = false;
			continue;
		}

		if (quote) {
			if (html[index] === quote) quote = "";
		} else if (html[index] === '"' || html[index] === "'") {
			quote = html[index];
		} else if (html[index] === ">") {
			const tag = getTagInfo(html, tagStart, index);
			if (!tag) {
				tagStart = -1;
				continue;
			}

			parts.push(html.slice(textStart, tagStart), INLINE_TAGS.has(tag.name) ? "" : " ");
			if (!tag.closing && (tag.name === "script" || tag.name === "style")) {
				const closingTag = findRawElementClosingTag(html, index + 1, tag.name);
				if (!closingTag) return parts.join("");
				index = closingTag.end;
			}
			textStart = index + 1;
			tagStart = -1;
			quote = "";
		}
	}

	// Preserve malformed/incomplete tags and their surrounding text.
	parts.push(html.slice(textStart));
	return parts.join("");
}

/** Strip HTML and normalize whitespace to produce readable plain text. */
export function stripHtmlToText(body: string): string {
	if (!body) return "";

	// ponytail: without a persisted MIME marker, paired/void-tag detection is
	// the smallest safe discriminator; ambiguous paired prose is the ceiling.
	const isHtml = looksLikeHtml(body);
	const text = isHtml
		? stripHtmlTags(body)
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
