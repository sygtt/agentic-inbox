// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

const CODE_PATTERN = /(?<!\d)\d{4,8}(?!\d)/g;
const CONTEXT_PATTERNS = [
	/\b(?:code|passcode)\s*(?:is|:)\s*__CODE__/i,
	/\b(?:auth(?:entication|enticate)?|confirmation|security|verification)\s+(?:code|number)\b\s*(?:is|:|-|=)?\s*__CODE__/i,
	/\b(?:auth|login|one[-\s]?time|otp|pass(?:code|word)|sign[-\s]?in)\s+(?:code|password)\b\s*(?:is|:|-|=)?\s*__CODE__/i,
	/__CODE__\s+(?:is|=)\s+(?:your\s+)?(?:auth(?:entication)?|confirmation|security|verification)\s+(?:code|number)\b/i,
	/\b(?:use|enter|input|type)\s+__CODE__\s+(?:to\s+)?(?:verify|confirm|authenticate)\b/i,
	/\b(?:verify|confirm|authenticate)\s+(?:with|using)\s+__CODE__/i,
];
const CONTEXT_RADIUS = 80;

function toSearchText(value: string): string {
	return value
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]*>/g, " ")
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/\s+/g, " ")
		.trim();
}

/** Return the first nearby 4–8 digit number that has verification context. */
export function extractVerificationCode(
	subject?: string | null,
	body?: string | null,
): string | null {
	const text = [subject, body]
		.filter((value): value is string => Boolean(value))
		.map(toSearchText)
		.filter(Boolean)
		.join(" ");

	for (const match of text.matchAll(CODE_PATTERN)) {
		const start = match.index ?? 0;
		const end = start + match[0].length;
		const contextStart = Math.max(0, start - CONTEXT_RADIUS);
		const context = `${text.slice(contextStart, start)}__CODE__${text.slice(
			end,
			Math.min(text.length, end + CONTEXT_RADIUS),
		)}`;
		if (CONTEXT_PATTERNS.some((pattern) => pattern.test(context))) return match[0];
	}

	return null;
}
