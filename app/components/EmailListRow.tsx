// SPDX-License-Identifier: Apache-2.0
// Modified in the sygtt/agentic-inbox fork; see Git history.
// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Tooltip } from "@cloudflare/kumo";
import {
	ArchiveIcon,
	ArrowBendUpLeftIcon,
	EnvelopeOpenIcon,
	EnvelopeSimpleIcon,
	PaperclipIcon,
	StarIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import type { MouseEvent } from "react";
import { formatListDate } from "shared/dates";
import { Folders } from "shared/folders";
import TriageErrorBadge from "~/components/triage/TriageErrorBadge";
import { getMobileEmailTagBadges } from "~/lib/mobile-email-tags";
import { getSnippetText } from "~/lib/utils";
import type { Email } from "~/types";

function formatParticipants(email: Email): string {
	if (email.participants) {
		const names = email.participants
			.split(",")
			.map((p) => p.trim().split("@")[0])
			.filter((name, idx, arr) => arr.indexOf(name) === idx);
		if (names.length <= 3) return names.join(", ");
		return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
	}
	return email.sender.split("@")[0];
}

export default function EmailListRow({
	email,
	isSelected,
	folder,
	isBusy,
	onOpen,
	onToggleStar,
	onToggleRead,
	onArchive,
	onDelete,
}: {
	email: Email;
	isSelected: boolean;
	folder?: string;
	isBusy: boolean;
	onOpen: (email: Email) => void;
	onToggleStar: (event: MouseEvent, email: Email) => void;
	onToggleRead: (email: Email) => void;
	onArchive: (email: Email) => void;
	onDelete: (event: MouseEvent, emailId: string) => void;
}) {
	const unread = email.thread_unread_count !== undefined
		? email.thread_unread_count > 0
		: !email.read;
	const participants = formatParticipants(email);
	const subject = email.subject || "(no subject)";
	const snippet = getSnippetText(email.snippet);
	const date = formatListDate(email.date);
	// The existing badge helper is viewport-independent; desktop uses a two-badge cap.
	const tagBadges = getMobileEmailTagBadges(email.tags, email.thread_has_triage_error, 2);
	const archiveLabel = folder === Folders.ARCHIVE || folder === Folders.TRASH
		? "Move to Inbox"
		: "Archive";
	const readLabel = unread ? "Mark read" : "Mark unread";
	const deleteLabel = folder === Folders.TRASH || folder === Folders.DRAFT
		? "Delete permanently"
		: "Delete";

	return (
		<div
			role="button"
			tabIndex={0}
			aria-label={`${unread ? "Unread" : "Read"}, ${subject}, from ${participants}, ${date}`}
			aria-current={isSelected ? "true" : undefined}
			data-selected={isSelected}
			data-unread={unread}
			onClick={() => onOpen(email)}
			onKeyDown={(event) => {
				if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
					event.preventDefault();
					onOpen(email);
				}
			}}
			className={`group relative flex w-full cursor-pointer items-center gap-2 border-b border-kumo-line border-l-2 px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kumo-brand ${isSelected ? "border-l-kumo-brand bg-kumo-tint" : "border-l-transparent hover:bg-kumo-tint"}`}
		>
			<div className="flex w-2 shrink-0 justify-center">
				{unread && <><span className="h-2 w-2 rounded-full bg-kumo-brand" aria-hidden="true" /><span className="sr-only">Unread</span></>}
			</div>
			<button
				type="button"
				className="shrink-0 cursor-pointer rounded border-0 bg-transparent p-0.5 focus-visible:outline-2 focus-visible:outline-kumo-brand"
				aria-label={email.starred ? "Unstar" : "Star"}
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					onToggleStar(event, email);
				}}
			>
				<StarIcon size={16} weight={email.starred ? "fill" : "regular"} className={email.starred ? "text-kumo-warning" : "text-kumo-subtle hover:text-kumo-warning"} />
			</button>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-2 leading-none">
					<span title={participants} className={`min-w-0 truncate text-sm leading-none ${unread ? "font-semibold text-kumo-default" : "text-kumo-strong"}`}>{participants}</span>
					{(email.thread_count ?? 1) > 1 && <span className="shrink-0 rounded-full bg-kumo-fill px-1.5 text-xs font-medium leading-none text-kumo-subtle">{email.thread_count}</span>}
					{email.has_draft && <span className="shrink-0 text-xs font-medium leading-none text-kumo-destructive">Draft</span>}
					{email.needs_reply && !email.has_draft && (
						<Tooltip content="Needs reply" asChild>
							<span className="shrink-0 text-kumo-warning" aria-label="Needs reply"><ArrowBendUpLeftIcon size={14} weight="bold" /></span>
						</Tooltip>
					)}
					{(email.has_attachment || !!email.attachments?.length) && <PaperclipIcon size={14} className="shrink-0 text-kumo-subtle" aria-label="Has attachment" />}
					{tagBadges.length > 0 && (
						<div className="flex shrink-0 items-center gap-1">
							{tagBadges.map((badge, index) => {
								if (badge.kind === "triage-error") {
									return <span key="triage-error" className="max-w-[5rem] shrink-0 overflow-hidden"><TriageErrorBadge tags={email.tags} threadHasTriageError={email.thread_has_triage_error} className="whitespace-nowrap" /></span>;
								}
								if (badge.kind === "overflow") {
									return <span key="tag-overflow" title={`${badge.count} more tags`} aria-label={`${badge.count} more tags`} className="shrink-0 rounded bg-kumo-fill px-1.5 py-0.5 text-[10px] leading-none text-kumo-subtle">+{badge.count}</span>;
								}
								return <span key={`${badge.tag}:${index}`} title={badge.label} className={`max-w-[5rem] shrink-0 truncate rounded px-1.5 py-0.5 text-[10px] leading-none ${badge.kind === "disposition" ? "bg-kumo-brand/10 font-medium text-kumo-brand" : "bg-kumo-fill text-kumo-subtle"}`}>{badge.label}</span>;
							})}
						</div>
					)}
					<span className="ml-auto shrink-0 text-xs leading-none tabular-nums text-kumo-subtle transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">{date}</span>
				</div>
				<div className="mt-0.5 flex min-w-0 items-baseline gap-1.5 text-xs leading-none">
					<span title={subject} className={`max-w-[55%] shrink-0 truncate ${unread ? "font-medium text-kumo-default" : "text-kumo-strong"}`}>{subject}</span>
					{snippet && <span className="min-w-0 flex-1 truncate text-xs leading-none text-kumo-subtle">— {snippet}</span>}
				</div>
			</div>
			<div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md bg-kumo-tint opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
				<Tooltip content={archiveLabel} asChild>
					<Button variant="ghost" shape="square" size="sm" icon={<ArchiveIcon size={14} />} disabled={isBusy} aria-label={archiveLabel} onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						onArchive(email);
					}} />
				</Tooltip>
				<Tooltip content={readLabel} asChild>
					<Button variant="ghost" shape="square" size="sm" icon={unread ? <EnvelopeOpenIcon size={14} /> : <EnvelopeSimpleIcon size={14} />} disabled={isBusy} aria-label={readLabel} onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						onToggleRead(email);
					}} />
				</Tooltip>
				<Tooltip content={deleteLabel} asChild>
					<Button variant="ghost" shape="square" size="sm" icon={<TrashIcon size={14} />} disabled={isBusy} aria-label={deleteLabel} onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						onDelete(event, email.id);
					}} />
				</Tooltip>
			</div>
		</div>
	);
}
