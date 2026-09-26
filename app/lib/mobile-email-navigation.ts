export interface MobileEmailNeighborIds {
	previousEmailId: string | null;
	nextEmailId: string | null;
}

const MOBILE_EMAIL_DETAIL_HISTORY_KEY = "agenticInboxMobileEmailDetailEntry";

export function withMobileEmailDetailHistoryEntry(state: unknown): Record<string, unknown> {
	const existing = state && typeof state === "object" && !Array.isArray(state)
		? state as Record<string, unknown>
		: {};
	return { ...existing, [MOBILE_EMAIL_DETAIL_HISTORY_KEY]: true };
}

export function isMobileEmailDetailHistoryEntry(state: unknown): boolean {
	return Boolean(
		state &&
		typeof state === "object" &&
		!Array.isArray(state) &&
		(state as Record<string, unknown>)[MOBILE_EMAIL_DETAIL_HISTORY_KEY] === true,
	);
}

/** Return adjacent email IDs in the order currently shown in the loaded list. */
export function getMobileEmailNeighborIds(
	emails: readonly { id: string }[],
	selectedEmailId: string | null,
): MobileEmailNeighborIds {
	const index = emails.findIndex((email) => email.id === selectedEmailId);
	if (index < 0) return { previousEmailId: null, nextEmailId: null };

	return {
		previousEmailId: emails[index - 1]?.id ?? null,
		nextEmailId: emails[index + 1]?.id ?? null,
	};
}
