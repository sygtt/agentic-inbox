// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { z } from "zod";
import { stripHtmlToText } from "./email-content.ts";
import { DISPOSITION_VALUES } from "./email-tags.ts";

export const TRIAGE_MODEL = "typesafe/jev";
export const TRIAGE_SCHEMA_VERSION = 1;
export const TRIAGE_POLICY_VERSION = 1;
export const MAX_CURRENT_BODY_CHARS = 12_000;
export const MAX_THREAD_MESSAGES = 8;
export const MAX_THREAD_MESSAGE_CHARS = 500;

export const TRIAGE_CATEGORIES = [
	"personal",
	"transactional",
	"account_security",
	"scheduling",
	"marketing",
	"informational",
	"other",
] as const;

export type TriageCategory = (typeof TRIAGE_CATEGORIES)[number];
export type TriageDisposition = (typeof DISPOSITION_VALUES)[number];

export interface TriageEmailInput {
	id: string;
	sender?: string | null;
	recipient?: string | null;
	envelope_recipient?: string | null;
	subject?: string | null;
	body?: string | null;
	folder_id?: string | null;
	date?: string | null;
	attachments?: readonly unknown[] | null;
}

export interface InboundTriageState {
	email: {
		sender: string | null;
		recipient: string | null;
		envelopeRecipient: string | null;
		subject: string | null;
		bodyText: string;
		hasAttachments: boolean;
	};
	thread: {
		messageCount: number;
		recentMessages: Array<{
			sender: string | null;
			recipient: string | null;
			subject: string | null;
			folderId: string;
			bodyText: string;
		}>;
	};
}

export interface TriageFeatures {
	category: {
		choice: TriageCategory;
		confidence: number;
		probabilities: Record<string, number>;
	};
	requiresReply: number;
	requiresAction: number;
	hasDeadline: number;
	financialImpact: number;
	securityRelevance: number;
	bulkMarketing: number;
	directPersonal: number;
	calendarCandidate: number;
	urgency: {
		score: number;
		confidence: number;
		probabilities: Record<string, number>;
	};
}

export interface InboundTriageResult {
	model: string;
	features: TriageFeatures;
}

export interface PersistedEmailTriageResult extends InboundTriageResult {
	schemaVersion: number;
	policyVersion: number;
	predictedDisposition: TriageDisposition;
}

const booleanCriteria = {
	true: "The email clearly indicates this is true.",
	false: "The email does not indicate this is true.",
} as const;

export const TRIAGE_QUESTIONS = {
	category: {
		type: "choice",
		instructions: "What is the primary category of this email?",
		criteria: {
			personal: "Direct personal communication intended for this recipient.",
			transactional: "Purchase, signup, booking, contract, delivery, or other transaction-related communication.",
			account_security: "Login, authentication, password, account compromise, or account protection.",
			scheduling: "A date, event, meeting, appointment, or other schedule-focused message.",
			marketing: "Advertising, promotion, newsletter, or campaign communication.",
			informational: "Information or notification that normally does not require a reply or action.",
			other: "Does not clearly fit the other categories.",
		},
	},
	requires_reply: {
		type: "noul",
		instructions: "Is a reply from the recipient reasonably expected?",
		criteria: booleanCriteria,
	},
	requires_action: {
		type: "noul",
		instructions: "Does the recipient need to take any action, including replying?",
		criteria: booleanCriteria,
	},
	has_deadline: {
		type: "noul",
		instructions: "Does the email contain an explicit or substantive deadline?",
		criteria: booleanCriteria,
	},
	financial_impact: {
		type: "noul",
		instructions: "Could this email affect payments, billing, refunds, fees, or financial loss?",
		criteria: booleanCriteria,
	},
	security_relevance: {
		type: "noul",
		instructions: "Does this email relate to authentication, account compromise, or security response?",
		criteria: booleanCriteria,
	},
	bulk_marketing: {
		type: "noul",
		instructions: "Is the primary purpose bulk advertising, promotion, or newsletter delivery?",
		criteria: booleanCriteria,
	},
	direct_personal: {
		type: "noul",
		instructions: "Is this content directly addressed to this individual rather than an unspecified audience?",
		criteria: booleanCriteria,
	},
	calendar_candidate: {
		type: "noul",
		instructions: "Could this email reasonably become a calendar event because it concerns a scheduled date or time?",
		criteria: booleanCriteria,
	},
	urgency: {
		type: "score",
		instructions: "How urgent is the email?",
		criteria: [
			"Not urgent; it can wait several days or longer.",
			"Low to medium urgency; it should be checked sometime this week.",
			"High urgency; it should be checked or handled today.",
			"Emergency; it should be checked or handled immediately.",
		],
	},
} as const;

function nullable(value: string | null | undefined): string | null {
	return value && value.trim() ? value : null;
}

function truncate(text: string, limit: number): string {
	return Array.from(text).slice(0, limit).join("");
}

function bodyText(email: TriageEmailInput, limit: number): string {
	return truncate(stripHtmlToText(email.body ?? ""), limit);
}

function dateValue(value: string | null | undefined): number {
	const timestamp = value ? Date.parse(value) : Number.NaN;
	return Number.isFinite(timestamp) ? timestamp : 0;
}

/** Build the bounded, plain-text state sent to Jev. */
export function buildInboundTriageState(
	currentEmail: TriageEmailInput,
	threadEmails: readonly TriageEmailInput[] = [],
): InboundTriageState {
	const seen = new Set<string>();
	const allMessages = [currentEmail, ...threadEmails].filter((email) => {
		if (seen.has(email.id)) return false;
		seen.add(email.id);
		return true;
	});
	const recentMessages = allMessages
		.filter((email) => email.id !== currentEmail.id)
		.sort((a, b) => dateValue(b.date) - dateValue(a.date))
		.slice(0, MAX_THREAD_MESSAGES)
		.map((email) => ({
			sender: nullable(email.sender),
			recipient: nullable(email.recipient),
			subject: nullable(email.subject),
			folderId: email.folder_id ?? "",
			bodyText: bodyText(email, MAX_THREAD_MESSAGE_CHARS),
		}));

	return {
		email: {
			sender: nullable(currentEmail.sender),
			recipient: nullable(currentEmail.recipient),
			envelopeRecipient: nullable(currentEmail.envelope_recipient),
			subject: nullable(currentEmail.subject),
			bodyText: bodyText(currentEmail, MAX_CURRENT_BODY_CHARS),
			hasAttachments: (currentEmail.attachments?.length ?? 0) > 0,
		},
		thread: {
			messageCount: allMessages.length,
			recentMessages,
		},
	};
}

const probabilitySchema = z.record(z.string(), z.number().finite().min(0).max(1));
const confidenceSchema = z.number().finite().min(0).max(1);
const choiceAnswerSchema = z.object({
	type: z.literal("choice"),
	choice: z.enum(TRIAGE_CATEGORIES),
	confidence: confidenceSchema,
	probabilities: probabilitySchema,
});
const noulAnswerSchema = z.object({
	type: z.literal("noul"),
	noul: z.number().finite().min(0).max(1),
});
const scoreAnswerSchema = z.object({
	type: z.literal("score"),
	score: z.number().finite().min(0).max(3),
	confidence: confidenceSchema,
	probabilities: probabilitySchema,
});
const responseSchema = z.object({
	model: z.string().min(1),
	answers: z.record(z.unknown()),
});

function requiredAnswer(answers: Record<string, unknown>, name: string): unknown {
	const camelName = name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
	const answer = answers[name] ?? answers[camelName];
	if (answer === undefined) throw new Error(`Jev response is missing answer: ${name}`);
	return answer;
}

function parseAnswer<T>(schema: z.ZodType<T>, answer: unknown, name: string): T {
	const result = schema.safeParse(answer);
	if (!result.success) {
		throw new Error(`Invalid Jev answer "${name}": ${result.error.message}`);
	}
	return result.data;
}

/** Validate and normalize the raw Jev response; model versions remain data. */
export function parseJevResponse(raw: unknown): InboundTriageResult {
	const response = responseSchema.safeParse(raw);
	if (!response.success) {
		throw new Error(`Invalid Jev response: ${response.error.message}`);
	}

	const answers = response.data.answers;
	const category = parseAnswer(choiceAnswerSchema, requiredAnswer(answers, "category"), "category");
	const urgency = parseAnswer(scoreAnswerSchema, requiredAnswer(answers, "urgency"), "urgency");
	const features: TriageFeatures = {
		category: {
			choice: category.choice,
			confidence: category.confidence,
			probabilities: category.probabilities,
		},
		requiresReply: parseAnswer(noulAnswerSchema, requiredAnswer(answers, "requires_reply"), "requires_reply").noul,
		requiresAction: parseAnswer(noulAnswerSchema, requiredAnswer(answers, "requires_action"), "requires_action").noul,
		hasDeadline: parseAnswer(noulAnswerSchema, requiredAnswer(answers, "has_deadline"), "has_deadline").noul,
		financialImpact: parseAnswer(noulAnswerSchema, requiredAnswer(answers, "financial_impact"), "financial_impact").noul,
		securityRelevance: parseAnswer(noulAnswerSchema, requiredAnswer(answers, "security_relevance"), "security_relevance").noul,
		bulkMarketing: parseAnswer(noulAnswerSchema, requiredAnswer(answers, "bulk_marketing"), "bulk_marketing").noul,
		directPersonal: parseAnswer(noulAnswerSchema, requiredAnswer(answers, "direct_personal"), "direct_personal").noul,
		calendarCandidate: parseAnswer(noulAnswerSchema, requiredAnswer(answers, "calendar_candidate"), "calendar_candidate").noul,
		urgency: {
			score: urgency.score,
			confidence: urgency.confidence,
			probabilities: urgency.probabilities,
		},
	};

	return { model: response.data.model, features };
}

export interface TriageAI {
	run(model: string, input: unknown): Promise<unknown>;
}

/** Run Jev with the fixed v1 questions and validate its result. */
export async function analyzeInboundEmail(
	ai: TriageAI,
	state: InboundTriageState,
): Promise<InboundTriageResult> {
	const response = await ai.run(TRIAGE_MODEL, {
		state,
		questions: TRIAGE_QUESTIONS,
	});
	return parseJevResponse(response);
}

/** Deterministic disposition policy v1; this never moves or deletes mail. */
export function decideDisposition(features: TriageFeatures): TriageDisposition {
	if (
		features.securityRelevance >= 0.8 ||
		features.financialImpact >= 0.85 ||
		features.requiresAction >= 0.8 ||
		features.requiresReply >= 0.8 ||
		(features.hasDeadline >= 0.75 && features.urgency.score >= 1.5)
	) {
		return "action-required";
	}

	if (
		features.bulkMarketing >= 0.9 &&
		features.requiresAction <= 0.2 &&
		features.requiresReply <= 0.2 &&
		features.financialImpact <= 0.2 &&
		features.securityRelevance <= 0.2
	) {
		return "auto-file";
	}

	const clearlyLowSignal =
		features.requiresAction < 0.3 &&
		features.requiresReply < 0.3 &&
		features.hasDeadline < 0.3 &&
		features.financialImpact < 0.3 &&
		features.securityRelevance < 0.3 &&
		features.urgency.score < 1;
	if (clearlyLowSignal) return "hold";
	return "review";
}
