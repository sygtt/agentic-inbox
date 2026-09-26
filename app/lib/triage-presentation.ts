import type { EmailTag, EmailTriageAnalysis } from "~/types";

export const TRIAGE_ERROR_LABEL = "分類エラー";
export const TRIAGE_ERROR_DESCRIPTION = "Jevによる自動分類に失敗しました";
export const THREAD_TRIAGE_ERROR_LABEL = "スレッド内に分類エラーあり";
export const THREAD_TRIAGE_ERROR_DESCRIPTION = "このスレッド内のいずれかのメールでJevによる自動分類に失敗しました";

export function getTriageErrorPresentation(
	tags: readonly EmailTag[] | undefined,
) {
	if (!tags?.some(({ tag, provenance }) => tag === "triage:error" && provenance === "system")) return null;
	return {
		label: TRIAGE_ERROR_LABEL,
		description: TRIAGE_ERROR_DESCRIPTION,
		accessibleName: `${TRIAGE_ERROR_LABEL}。${TRIAGE_ERROR_DESCRIPTION}`,
	};
}

export function getThreadTriageErrorPresentation() {
	return {
		label: THREAD_TRIAGE_ERROR_LABEL,
		description: THREAD_TRIAGE_ERROR_DESCRIPTION,
		accessibleName: `${THREAD_TRIAGE_ERROR_LABEL}。${THREAD_TRIAGE_ERROR_DESCRIPTION}`,
	};
}

export interface TriageFeatureRow {
	key: string;
	label: string;
	value: string;
}

function percent(value: number): string {
	return new Intl.NumberFormat("en", {
		style: "percent",
		maximumFractionDigits: 1,
	}).format(value);
}

function distribution(values: Record<string, number>): string {
	return Object.entries(values)
		.sort((a, b) => b[1] - a[1])
		.map(([key, value]) => `${key} ${percent(value)}`)
		.join(" · ");
}

export function getTriageFeatureRows(
	features: EmailTriageAnalysis["features"],
): TriageFeatureRow[] {
	return [
		{ key: "category.choice", label: "予測カテゴリ", value: features.category.choice },
		{ key: "category.confidence", label: "カテゴリ確信度", value: percent(features.category.confidence) },
		{ key: "category.probabilities", label: "カテゴリ確率", value: distribution(features.category.probabilities) },
		{ key: "requiresReply", label: "返信必要度", value: percent(features.requiresReply) },
		{ key: "requiresAction", label: "対応必要度", value: percent(features.requiresAction) },
		{ key: "hasDeadline", label: "期限あり", value: percent(features.hasDeadline) },
		{ key: "financialImpact", label: "金銭影響", value: percent(features.financialImpact) },
		{ key: "securityRelevance", label: "セキュリティ関連", value: percent(features.securityRelevance) },
		{ key: "bulkMarketing", label: "一斉マーケティング", value: percent(features.bulkMarketing) },
		{ key: "directPersonal", label: "本人向け", value: percent(features.directPersonal) },
		{ key: "calendarCandidate", label: "カレンダー候補", value: percent(features.calendarCandidate) },
		{ key: "urgency.score", label: "緊急度スコア", value: `${features.urgency.score.toFixed(1)} / 3` },
		{ key: "urgency.confidence", label: "緊急度確信度", value: percent(features.urgency.confidence) },
		{ key: "urgency.probabilities", label: "緊急度確率", value: distribution(features.urgency.probabilities) },
	];
}

export function formatAnalyzedAt(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
