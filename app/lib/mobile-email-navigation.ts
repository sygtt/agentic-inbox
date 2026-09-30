export interface MobileEmailNeighborIds {
	previousEmailId: string | null;
	nextEmailId: string | null;
}

export type MobileArchiveSuccessAction =
	| { type: "none" }
	| { type: "close" }
	| { type: "navigate"; emailId: string };

export function isEmailStillSelected(selectedEmailId: string | null, emailId: string): boolean {
	return selectedEmailId === emailId;
}

/** Keep archive completion behavior scoped to the still-selected email. */
export function getMobileArchiveSuccessAction({
	isMobileViewport,
	selectedEmailId,
	archivedEmailId,
	nextEmailId,
}: {
	isMobileViewport: boolean;
	selectedEmailId: string | null;
	archivedEmailId: string;
	nextEmailId: string | null;
}): MobileArchiveSuccessAction {
	if (!isEmailStillSelected(selectedEmailId, archivedEmailId)) return { type: "none" };
	if (!isMobileViewport || !nextEmailId) return { type: "close" };
	return { type: "navigate", emailId: nextEmailId };
}

export function shouldMarkUrlSelectedEmailRead({
	isMobileViewport,
	isComposing,
	urlSelectedEmailId,
	selectedEmailId,
	emailId,
	lastMarkedEmailId,
}: {
	isMobileViewport: boolean;
	isComposing: boolean;
	urlSelectedEmailId: string | null;
	selectedEmailId: string | null;
	emailId: string;
	lastMarkedEmailId: string | null;
}): boolean {
	return isMobileViewport &&
		!isComposing &&
		urlSelectedEmailId === emailId &&
		selectedEmailId === emailId &&
		lastMarkedEmailId !== emailId;
}

export type MobileEmailSelectionAction =
	| { type: "select-url-email"; emailId: string }
	| { type: "write-selected-email-to-url"; emailId: string }
	| { type: "clear-selection" }
	| { type: "none" };

export function getMobileEmailSelectionAction({
	isMobileViewport,
	wasMobileViewport,
	wasComposing,
	urlSelectedEmailId,
	selectedEmailId,
	isComposing,
}: {
	isMobileViewport: boolean;
	wasMobileViewport: boolean;
	wasComposing: boolean;
	urlSelectedEmailId: string | null;
	selectedEmailId: string | null;
	isComposing: boolean;
}): MobileEmailSelectionAction {
	if (!isMobileViewport || isComposing) return { type: "none" };
	if (urlSelectedEmailId) {
		return selectedEmailId === urlSelectedEmailId
			? { type: "none" }
			: { type: "select-url-email", emailId: urlSelectedEmailId };
	}
	if (!selectedEmailId) return { type: "none" };
	if (wasComposing || !wasMobileViewport) return { type: "write-selected-email-to-url", emailId: selectedEmailId };
	return { type: "clear-selection" };
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

export type MobileEmailPanelCloseAction =
	| { type: "none" }
	| { type: "return-through-history" }
	| { type: "clear-url-selection" };

export function getMobileEmailPanelCloseAction({
	urlSelectedEmailId,
	returnThroughHistory,
	locationState,
}: {
	urlSelectedEmailId: string | null;
	returnThroughHistory: boolean;
	locationState: unknown;
}): MobileEmailPanelCloseAction {
	if (!urlSelectedEmailId) return { type: "none" };
	if (returnThroughHistory && isMobileEmailDetailHistoryEntry(locationState)) {
		return { type: "return-through-history" };
	}
	return { type: "clear-url-selection" };
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
