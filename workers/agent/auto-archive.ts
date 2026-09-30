// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Folders } from "../../shared/folders.ts";

type InboundTriageOutcome = {
	status: string;
	predictedDisposition?: string;
	dispositionApplied?: boolean;
};

type EmailFolderStorage = {
	moveEmail(emailId: string, folderId: string): Promise<boolean>;
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
		const moved = await storage.moveEmail(emailId, Folders.ARCHIVE);
		if (!moved) {
			logError("Auto-archive failed: email could not be moved to Archive", emailId);
			return "failed";
		}
		return "archived";
	} catch (error) {
		logError("Auto-archive failed:", emailId, errorMessage(error));
		return "failed";
	}
}
