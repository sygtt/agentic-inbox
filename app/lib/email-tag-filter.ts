export const DISPOSITION_FILTERS = [
	{ tag: "disposition:action-required", label: "Action required" },
	{ tag: "disposition:review", label: "Review" },
	{ tag: "disposition:auto-file", label: "Auto-file" },
] as const;

export interface EmailTagFilterOption {
	tag: string;
	label: string;
}

export function getEmailTagFilterOptions(
	availableTags: readonly string[],
): EmailTagFilterOption[] {
	const otherTags = [...new Set(availableTags)]
		.filter((tag) => !tag.startsWith("disposition:"))
		.sort((left, right) => left.localeCompare(right));

	return [
		...DISPOSITION_FILTERS,
		...otherTags.map((tag) => ({ tag, label: tag })),
	];
}

export function buildEmailListParams({
	folder,
	page,
	limit,
	needsReply,
	tag,
}: {
	folder: string;
	page: number;
	limit: number;
	needsReply: boolean;
	tag?: string;
}): Record<string, string> {
	return {
		folder,
		page: String(page),
		limit: String(limit),
		...(needsReply ? { needs_reply: "true" } : {}),
		...(tag ? { tag } : {}),
	};
}
