export interface MobileEmailNeighborIds {
	previousEmailId: string | null;
	nextEmailId: string | null;
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
