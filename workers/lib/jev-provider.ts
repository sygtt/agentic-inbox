// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

export interface JevProvider {
	evaluate(state: unknown, questions: unknown): Promise<unknown>;
}

export const TYPESAFE_JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const TYPESAFE_JEV_MODEL = "jev-1.13.0";

export interface TypeSafeJevProviderOptions {
	apiKey: string | undefined;
	fetch?: typeof fetch;
	endpoint?: string;
	model?: string;
}

/**
 * Direct TypeSafe System One API adapter.
 *
 * Keeping the provider boundary here lets triage move to another Jev host
 * without changing feature extraction, response validation, or persistence.
 */
export function createTypeSafeJevProvider({
	apiKey,
	fetch: fetchImpl = fetch,
	endpoint = TYPESAFE_JEV_ENDPOINT,
	model = TYPESAFE_JEV_MODEL,
}: TypeSafeJevProviderOptions): JevProvider {
	return {
		async evaluate(state, questions) {
			if (!apiKey?.trim()) {
				throw new Error("TYPESAFE_API_KEY is not configured");
			}

			const response = await fetchImpl(endpoint, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ model, state, questions }),
			});

			if (!response.ok) {
				const detail = (await response.text()).slice(0, 500);
				throw new Error(
					`TypeSafe Jev request failed (${response.status})${detail ? `: ${detail}` : ""}`,
				);
			}

			return response.json();
		},
	};
}
