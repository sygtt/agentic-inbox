// SPDX-License-Identifier: Apache-2.0

import { decodeHTML } from "entities";

export const MAX_VERIFICATION_CODE_CANDIDATES = 20;

export interface VerificationCodeCandidate {
	id: string;
	value: string;
}

const CODE_PATTERN = /(?<!\d)\d{4,8}(?!\d)/g;
const HTML_TAG_PATTERN = /<\/?[a-z][a-z\d:-]*(?:\s[^<>]*?)?\s*\/?>/gi;

/** Normalize HTML and entities before searching email text for digit candidates. */
export function normalizeVerificationCodeText(value: string): string {
	const withoutHtmlTags = value
		.replace(/<!--[^]*?-->/g, " ")
		.replace(/<style[^>]*>[^]*?<\/style>/gi, " ")
		.replace(/<script[^>]*>[^]*?<\/script>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(HTML_TAG_PATTERN, " ");
	return decodeHTML(withoutHtmlTags)
		.replace(/\s+/g, " ")
		.trim();
}

/** Extract stable, deterministic 4–8 digit candidates in subject/body order. */
export function extractVerificationCodeCandidates(
	subject?: string | null,
	body?: string | null,
): VerificationCodeCandidate[] {
	const candidates: VerificationCodeCandidate[] = [];
	const seenValues = new Set<string>();

	for (const value of [subject, body]) {
		if (!value) continue;
		const text = normalizeVerificationCodeText(value);
		for (const match of text.matchAll(CODE_PATTERN)) {
			const code = match[0];
			if (seenValues.has(code)) continue;
			seenValues.add(code);
			candidates.push({ id: `candidate_${candidates.length + 1}`, value: code });
			if (candidates.length === MAX_VERIFICATION_CODE_CANDIDATES) return candidates;
		}
	}

	return candidates;
}
