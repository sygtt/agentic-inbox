// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import TriageErrorBadge from "~/components/triage/TriageErrorBadge";
import TriageAnalysisDetails from "~/components/triage/TriageAnalysisDetails";
import { useEmailTags } from "~/queries/email-tags";

interface EmailPanelHeaderProps {
	subject: string;
	messageCount: number;
	showThreadCount: boolean;
	mailboxId?: string;
	emailId: string;
}

export default function EmailPanelHeader({
	subject,
	messageCount,
	showThreadCount,
	mailboxId,
	emailId,
}: EmailPanelHeaderProps) {
	const { data: tags = [] } = useEmailTags(mailboxId, emailId);

	return (
		<div className="px-4 py-3 border-b border-kumo-line shrink-0 md:px-6">
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="text-base font-semibold text-kumo-default">{subject}</h2>
				<TriageErrorBadge tags={tags} />
			</div>
			{showThreadCount && (
				<span className="text-xs text-kumo-subtle mt-0.5 block">
					{messageCount} messages in this thread
				</span>
			)}
			<TriageAnalysisDetails mailboxId={mailboxId} emailId={emailId} />
		</div>
	);
}
