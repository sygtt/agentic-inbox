// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { decodeHTML } from "entities";

export interface VerificationCodeCandidate {
	id: string;
	value: string;
}

const CODE_PATTERN = /(?<!\d)\d{4,8}(?!\d)/g;

/** Normalize HTML and entities before searching email text for digit candidates. */
export function normalizeVerificationCodeText(value: string): string {
	return decodeHTML(value)
		.replace(/<!--[^]*?-->/g, " ")
		.replace(/<style[^>]*>[^]*?<\/style>/gi, " ")
		.replace(/<script[^>]*>[^]*?<\/script>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<[^>]*>/g, " ")
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
		}
	}

	return candidates;
}
