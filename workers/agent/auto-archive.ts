// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

type InboundTriageOutcome = {
	status: string;
	predictedDisposition?: string;
	dispositionApplied?: boolean;
};

type EmailFolderStorage = {
	archiveAutoFiledEmailIfInInbox(emailId: string): Promise<"archived" | "skipped">;
};

export type AutoArchiveResult = "skipped" | "archived" | "failed";

function errorMessage(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message.replace(/[\r\n\t]+/g, " ").slice(0, 300) || "Unknown archive error";
}

/** Archive only a successfully persisted inbound auto-file disposition. */
export async function archiveAutoFiledEmail(
	storage: EmailFolderStorage,
	emailId: string,
	outcome: InboundTriageOutcome,
	logError: (...values: unknown[]) => void = console.error,
): Promise<AutoArchiveResult> {
	if (
		outcome.status !== "triaged" ||
		outcome.predictedDisposition !== "auto-file" ||
		outcome.dispositionApplied !== true
	) {
		return "skipped";
	}

	try {
		return await storage.archiveAutoFiledEmailIfInInbox(emailId);
	} catch (error) {
		logError("Auto-archive failed:", emailId, errorMessage(error));
		return "failed";
	}
}
