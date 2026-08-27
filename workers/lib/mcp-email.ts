// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * Present an email with readable text as the canonical MCP body.
 * The raw stored representation is retained only under body_html.
 */
export function toMcpEmailContent(email: Record<string, unknown>) {
	const { body, body_text, body_html, ...metadata } = email;
	const text = typeof body_text === "string" ? body_text : "";

	return {
		...metadata,
		body: text,
		body_text: text,
		body_html: body_html ?? body ?? null,
	};
}
