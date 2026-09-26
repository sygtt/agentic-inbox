import type { EmailTag } from "~/types";

const DISPOSITION_LABELS: Record<string, string> = {
	"disposition:action-required": "要対応",
	"disposition:review": "要確認",
	"disposition:auto-file": "自動整理",
};

export type MobileEmailTagBadge =
	| { kind: "triage-error" }
	| { kind: "disposition" | "tag"; tag: string; label: string }
	| { kind: "overflow"; count: number };

/** Build the prioritized, compact tag badges shown on mobile email rows. */
export function getMobileEmailTagBadges(
	tags: readonly EmailTag[] | undefined,
	threadHasTriageError = false,
): MobileEmailTagBadge[] {
	const allTags = tags ?? [];
	const hasSystemTriageError = allTags.some(
		({ tag, provenance }) => tag === "triage:error" && provenance === "system",
	);
	const badges: MobileEmailTagBadge[] = [];

	if (threadHasTriageError || hasSystemTriageError) {
		badges.push({ kind: "triage-error" });
	}

	for (const tag of allTags) {
		const label = DISPOSITION_LABELS[tag.tag];
		if (label) badges.push({ kind: "disposition", tag: tag.tag, label });
	}

	for (const tag of allTags) {
		if (tag.provenance === "system" || DISPOSITION_LABELS[tag.tag]) continue;
		badges.push({ kind: "tag", tag: tag.tag, label: tag.tag });
	}

	if (badges.length <= 3) return badges;
	return [
		...badges.slice(0, 2),
		{ kind: "overflow", count: badges.length - 2 },
	];
}
