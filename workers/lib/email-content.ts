// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { decodeHTML } from "entities";

const TEXT_BOUNDARY_TAGS = new Set([
	"address", "article", "aside", "blockquote", "body", "br", "caption",
	"dd", "details", "dialog", "div", "dl", "dt", "fieldset", "figcaption",
	"figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head",
	"header", "hgroup", "hr", "html", "legend", "li", "main", "nav", "ol",
	"option", "p", "pre", "script", "section", "style", "table", "tbody",
	"td", "tfoot", "th", "thead", "tr", "ul", "center",
	"img",
]);

const HIDDEN_TAGS = new Set(["head", "script", "style", "template", "title"]);
const HEAD_CONTENT_TAGS = new Set(["base", "link", "meta", "noscript", "script", "style", "title"]);

function findTagEnd(html: string, start: number): number {
	let quote = "";
	for (let index = start; index < html.length; index++) {
		if (quote) {
			if (html[index] === quote) quote = "";
		} else if (html[index] === '"' || html[index] === "'") {
			quote = html[index];
		} else if (html[index] === ">") {
			return index;
		}
	}
	return -1;
}

function isTagNameStart(char: string | undefined): boolean {
	return !!char && /[a-z]/i.test(char);
}

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

	if (!isTagNameStart(html[index])) return null;
	const nameStart = index;
	while (isTagNameChar(html[index])) index++;
	if (index === nameStart) return null;
	const next = html[index];
	if (closing ? next !== ">" && next !== "/" && !/\s/.test(next || "") : next !== ">" && next !== "/" && !/\s/.test(next || "")) {
		return null;
	}

	return { name: html.slice(nameStart, index).toLowerCase(), closing, index };
}

function extractImageAlt(html: string, start: number, end: number): string | null {
	let index = start + 1;
	while (isTagNameChar(html[index])) index++;

	while (index < end) {
		while (index < end && /[\s/]/.test(html[index])) index++;
		const nameStart = index;
		while (index < end && !/[\s=/>]/.test(html[index])) index++;
		if (index === nameStart) {
			index++;
			continue;
		}

		const name = html.slice(nameStart, index).toLowerCase();
		while (index < end && /\s/.test(html[index])) index++;
		if (html[index] !== "=") continue;
		index++;
		while (index < end && /\s/.test(html[index])) index++;

		let value = "";
		const quote = html[index];
		if (quote === '"' || quote === "'") {
			index++;
			const valueStart = index;
			while (index < end && html[index] !== quote) index++;
			value = html.slice(valueStart, index);
			if (index < end) index++;
		} else {
			const valueStart = index;
			while (index < end && !/[\s/>]/.test(html[index])) index++;
			value = html.slice(valueStart, index);
		}
		if (name === "alt") return value;
	}

	return null;
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
	let depth = 1;
	for (let index = start; index < html.length; index++) {
		if (name === "head") {
			const tag = readTagName(html, index);
			if (tag && !tag.closing && !HEAD_CONTENT_TAGS.has(tag.name)) {
				return { end: index - 1, name, closing: true };
			}
		}
		if (html[index] !== "<") continue;
		const tag = readTagName(html, index);
		if (!tag || tag.name !== name) continue;
		if (!tag.closing && name !== "template") continue;
		const end = findTagEnd(html, index);
		if (end === -1) return null;
		if (tag.closing) {
			depth--;
			if (depth === 0) return { end, name, closing: true };
		} else {
			depth++;
		}
		index = end;
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

			const separator = tag.name === "" || TEXT_BOUNDARY_TAGS.has(tag.name) ? " " : "";
			const alt = tag.name === "img" && !tag.closing ? extractImageAlt(html, tagStart, index) : null;
			parts.push(html.slice(textStart, tagStart), alt === null ? separator : " " + alt + " ");
			if (!tag.closing && HIDDEN_TAGS.has(tag.name)) {
				const closingTag = findRawElementClosingTag(html, index + 1, tag.name);
				if (!closingTag) return parts.join("");
				index = closingTag.end;
			}
			textStart = index + 1;
			tagStart = -1;
			quote = "";
		}
	}

	if (comment) {
		parts.push(html.slice(textStart, tagStart));
		return parts.join("");
	}
	// Preserve malformed/incomplete tags and their surrounding text.
	parts.push(html.slice(textStart));
	return parts.join("");
}

/** Strip HTML and normalize whitespace to produce readable plain text. */
export function stripHtmlToText(body: string): string {
	if (!body) return "";

	// ponytail: without a persisted MIME marker, syntax-based detection is
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
