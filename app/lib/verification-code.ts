// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

const CODE_PATTERN = /(?<!\d)\d{4,8}(?!\d)/g;
const CONTEXT_PATTERNS = [
	/\b(?:auth(?:entication|enticate)?|login|one[-\s]?time|otp|pass(?:code|word)|security|sign[-\s]?in|verif(?:ication|y))\b/i,
	/\b(?:confirm(?:ation)?|confirmation)\s+(?:code|number)\b/i,
	/\b(?:code|passcode)\s*(?:is|:)\s*\d/i,
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

	let bestMatch: { code: string; distance: number } | null = null;
	for (const match of text.matchAll(CODE_PATTERN)) {
		const start = match.index ?? 0;
		const end = start + match[0].length;
		const contextStart = Math.max(0, start - CONTEXT_RADIUS);
		const context = text.slice(
			contextStart,
			Math.min(text.length, end + CONTEXT_RADIUS),
		);
		const distances = CONTEXT_PATTERNS.flatMap((pattern) => {
			const contextMatch = pattern.exec(context);
			return contextMatch?.index == null
				? []
				: [Math.abs(contextStart + contextMatch.index - start)];
		});
		const distance = Math.min(...distances);
		if (Number.isFinite(distance) && (!bestMatch || distance < bestMatch.distance)) {
			bestMatch = { code: match[0], distance };
		}
	}

	return bestMatch?.code ?? null;
}
