const MAX_TRIAGE_ERROR_CHARS = 300;

function boundedErrorMessage(error: unknown): string {
	const message = error instanceof Error
		? error.message
		: typeof error === "string"
			? error
			: "Unknown triage error";
	return message.replace(/[\r\n\t]+/g, " ").slice(0, MAX_TRIAGE_ERROR_CHARS) || "Unknown triage error";
}

export type TriageFailureResult =
	| { status: "triage_failed"; error: string }
	| { status: "email_not_found" };

/** Persist the operational marker without replacing the original triage failure. */
export async function handleTriageFailure(
	originalError: unknown,
	markEmailTriageFailed: () => Promise<unknown>,
	logError: (...values: unknown[]) => void = console.error,
): Promise<TriageFailureResult> {
	try {
		const marker = await markEmailTriageFailed();
		if (marker === null) return { status: "email_not_found" };
	} catch (markerError) {
		logError(
			"Auto-triage failure marker persistence failed:",
			boundedErrorMessage(markerError),
		);
	}

	const error = boundedErrorMessage(originalError);
	logError("Auto-triage failed:", error);
	return { status: "triage_failed", error };
}
