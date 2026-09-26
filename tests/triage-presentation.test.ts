import assert from "node:assert/strict";
import { test } from "node:test";
import type { EmailTriageAnalysis } from "../app/types/index.ts";
import {
	formatAnalyzedAt,
	getTriageErrorPresentation,
	getThreadTriageErrorPresentation,
	getTriageFeatureRows,
} from "../app/lib/triage-presentation.ts";

test("provides an accessible, descriptive triage error badge only for the reserved tag", () => {
	assert.deepEqual(getTriageErrorPresentation([{ tag: "triage:error", provenance: "agent" }]), {
		label: "分類エラー",
		description: "Jevによる自動分類に失敗しました",
		accessibleName: "分類エラー。Jevによる自動分類に失敗しました",
	});
	assert.equal(getTriageErrorPresentation([{ tag: "source:newsletter", provenance: "manual" }]), null);
	assert.equal(getTriageErrorPresentation(undefined), null);
});

test("describes a list-level triage error as a thread aggregate", () => {
	assert.deepEqual(getThreadTriageErrorPresentation(), {
		label: "スレッド内に分類エラーあり",
		description: "このスレッド内のいずれかのメールでJevによる自動分類に失敗しました",
		accessibleName: "スレッド内に分類エラーあり。このスレッド内のいずれかのメールでJevによる自動分類に失敗しました",
	});
});

test("exposes every triage feature in a compact presentation model", () => {
	const features: EmailTriageAnalysis["features"] = {
		category: { choice: "marketing", confidence: 0.9, probabilities: { marketing: 0.9, other: 0.1 } },
		requiresReply: 0.04,
		requiresAction: 0.31,
		hasDeadline: 0.12,
		financialImpact: 0.02,
		securityRelevance: 0.01,
		bulkMarketing: 0.96,
		directPersonal: 0.08,
		calendarCandidate: 0.03,
		urgency: { score: 1.2, confidence: 0.84, probabilities: { "1": 0.8, "0": 0.2 } },
	};
	const rows = getTriageFeatureRows(features);
	assert.deepEqual(rows.map(({ key }) => key), [
		"category.choice",
		"category.confidence",
		"category.probabilities",
		"requiresReply",
		"requiresAction",
		"hasDeadline",
		"financialImpact",
		"securityRelevance",
		"bulkMarketing",
		"directPersonal",
		"calendarCandidate",
		"urgency.score",
		"urgency.confidence",
		"urgency.probabilities",
	]);
	assert.equal(rows.find(({ key }) => key === "category.choice")?.value, "marketing");
	assert.equal(rows.find(({ key }) => key === "urgency.score")?.value, "1.2 / 3");
});

test("formats analyzedAt for display and safely preserves an invalid source value", () => {
	assert.notEqual(formatAnalyzedAt("2026-09-26T12:00:00.000Z"), "");
	assert.equal(formatAnalyzedAt("not-a-date"), "not-a-date");
});
