// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { z } from "zod";

export const TAG_PROVENANCES = ["rule", "agent", "manual"] as const;
export const DISPOSITION_VALUES = [
	"action-required",
	"review",
	"auto-file",
	"hold",
] as const;

const TAG_PATTERN = /^[a-z][a-z0-9-]{0,31}:[a-z0-9][a-z0-9._-]{0,62}$/;

export const TagSchema = z
	.string()
	.trim()
	.toLowerCase()
	.max(96)
	.regex(TAG_PATTERN, "Tag must use a namespace:value format");

export const TagProvenanceSchema = z.enum(TAG_PROVENANCES);

export const TagAssignmentRequestSchema = z
	.object({ tag: TagSchema, provenance: TagProvenanceSchema })
	.strict();

export const DispositionRequestSchema = z
	.object({ value: z.enum(DISPOSITION_VALUES), provenance: TagProvenanceSchema })
	.strict();

export function isDispositionTag(tag: string): boolean {
	return tag.startsWith("disposition:");
}
