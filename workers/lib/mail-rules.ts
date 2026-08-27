// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { z } from "zod";
import { isDispositionTag, TagSchema } from "./email-tags.ts";

const AddressConditionSchema = z.string().trim().toLowerCase().email();
const DomainConditionSchema = z
	.string()
	.trim()
	.toLowerCase()
	.min(1)
	.max(253)
	.regex(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/, "Invalid sender domain");

export const MailRuleConditionsSchema = z
	.object({
		envelopeRecipient: AddressConditionSchema.optional(),
		sender: AddressConditionSchema.optional(),
		senderDomain: DomainConditionSchema.optional(),
		subjectContains: z.string().trim().min(1).max(200).optional(),
	})
	.strict()
	.refine((conditions) => Object.values(conditions).some((value) => value !== undefined), {
		message: "At least one condition is required",
	});

const RuleTagSchema = TagSchema.refine((tag) => !isDispositionTag(tag), {
	message: "Disposition tags must use the disposition endpoint",
});

export const MailRuleActionSchema = z
	.object({
		folderId: z.string().trim().min(1).max(128).optional(),
		tags: z
			.array(RuleTagSchema)
			.max(32)
			.refine((tags) => new Set(tags).size === tags.length, "Rule tags must be unique")
			.default([]),
	})
	.strict()
	.refine((action) => action.folderId !== undefined || action.tags.length > 0, {
		message: "A rule must assign a folder or add at least one tag",
	});

export const MailRuleInputSchema = z
	.object({
		conditions: MailRuleConditionsSchema,
		action: MailRuleActionSchema,
	})
	.strict();

export const MailRuleSchema = MailRuleInputSchema.extend({
	id: z.string().uuid(),
});

export const MailRuleListSchema = z
	.array(MailRuleSchema)
	.max(100)
	.superRefine((rules, ctx) => {
		const ids = new Set<string>();
		for (const [index, rule] of rules.entries()) {
			if (ids.has(rule.id)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: [index, "id"],
					message: "Rule IDs must be unique",
				});
			}
			ids.add(rule.id);
		}
	});

export const MailRuleIdSchema = z.string().uuid();

export const MailRuleReorderRequestSchema = z
	.object({ ruleIds: z.array(MailRuleIdSchema).max(100) })
	.strict();

export type MailRule = z.infer<typeof MailRuleSchema>;
export type MailRuleInput = z.infer<typeof MailRuleInputSchema>;

export interface RuleMatchInput {
	envelopeRecipient: string;
	sender: string;
	subject: string;
}

export function matchesMailRule(rule: MailRule, input: RuleMatchInput): boolean {
	const sender = input.sender.trim().toLowerCase();
	const senderDomain = sender.split("@").at(-1) || "";
	const subject = input.subject.toLowerCase();
	const conditions = rule.conditions;

	return (
		(conditions.envelopeRecipient === undefined || conditions.envelopeRecipient === input.envelopeRecipient) &&
		(conditions.sender === undefined || conditions.sender === sender) &&
		(conditions.senderDomain === undefined || conditions.senderDomain === senderDomain) &&
		(conditions.subjectContains === undefined || subject.includes(conditions.subjectContains.toLowerCase()))
	);
}

export function evaluateMailRules(
	rawRules: unknown,
	input: RuleMatchInput,
): { rule: MailRule | null; invalid: boolean } {
	const parsed = MailRuleListSchema.safeParse(rawRules);
	if (!parsed.success) return { rule: null, invalid: true };

	return {
		rule: parsed.data.find((rule) => matchesMailRule(rule, input)) || null,
		invalid: false,
	};
}

type MailboxSettings = Record<string, unknown>;

export async function readMailboxRules(
	bucket: R2Bucket,
	mailboxId: string,
): Promise<{ settings: MailboxSettings; rules: MailRule[] } | null> {
	const object = await bucket.get(`mailboxes/${mailboxId}.json`);
	if (!object) return null;

	const settings = await object.json<MailboxSettings>();
	const parsed = MailRuleListSchema.safeParse(settings.rules === undefined ? [] : settings.rules);
	if (!parsed.success) throw new Error(`Invalid mail rules for mailbox ${mailboxId}`);

	return { settings, rules: parsed.data };
}

export async function saveMailboxRules(
	bucket: R2Bucket,
	mailboxId: string,
	rules: MailRule[],
): Promise<boolean> {
	const current = await readMailboxRules(bucket, mailboxId);
	if (!current) return false;
	await bucket.put(
		`mailboxes/${mailboxId}.json`,
		JSON.stringify({ ...current.settings, rules }),
	);
	return true;
}
