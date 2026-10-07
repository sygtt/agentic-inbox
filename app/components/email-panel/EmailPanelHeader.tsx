// SPDX-License-Identifier: Apache-2.0
// Modified in the sygtt/agentic-inbox fork; see Git history.
// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import TriageErrorBadge from "~/components/triage/TriageErrorBadge";
import TriageAnalysisDetails from "~/components/triage/TriageAnalysisDetails";
import { getMobileEmailTagBadges } from "~/lib/mobile-email-tags";
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
	const { data: tags = [] } = useEmailTags(mailboxId, emailId, { refreshWhileTriagePending: true });
	const tagBadges = getMobileEmailTagBadges(tags, false, 3);
	const visibleTagBadges = tagBadges.filter((badge) => badge.kind !== "triage-error");

	return (
		<div className="px-4 py-3 border-b border-kumo-line shrink-0 md:px-6">
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="text-lg font-semibold text-kumo-default">{subject}</h2>
				<TriageErrorBadge tags={tags} />
			</div>
			{(showThreadCount || visibleTagBadges.length > 0) && (
				<div className="mt-0.5 flex flex-wrap items-center gap-2">
					{showThreadCount && (
						<span className="text-xs text-kumo-subtle">
							{messageCount} messages in this thread
						</span>
					)}
					{visibleTagBadges.length > 0 && (
						<div className="flex flex-wrap items-center gap-1">
							{visibleTagBadges.map((badge, index) => {
								if (badge.kind === "overflow") {
									return <span key="tag-overflow" title={`${badge.count} more tags`} aria-label={`${badge.count} more tags`} className="rounded bg-kumo-fill px-1.5 py-0.5 text-[10px] text-kumo-subtle">+{badge.count}</span>;
								}
								return <span key={`${badge.tag}:${index}`} title={badge.label} className={`rounded px-1.5 py-0.5 text-[10px] ${badge.kind === "disposition" ? "bg-kumo-brand/10 font-medium text-kumo-brand" : "bg-kumo-fill text-kumo-subtle"}`}>{badge.label}</span>;
							})}
						</div>
					)}
				</div>
			)}
			<TriageAnalysisDetails mailboxId={mailboxId} emailId={emailId} />
		</div>
	);
}
