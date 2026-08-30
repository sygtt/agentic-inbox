// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button } from "@cloudflare/kumo";
import {
	ArchiveIcon,
	ArrowBendUpLeftIcon,
	ArrowLeftIcon,
	DotsThreeIcon,
	PencilSimpleIcon,
	StarIcon,
	TagIcon,
} from "@phosphor-icons/react";
import { formatDetailDate } from "shared/dates";
import { Folders } from "shared/folders";
import { useEffect, useState } from "react";
import type { Email, Folder } from "~/types";
import { useEmailTags } from "~/queries/email-tags";
import SingleMessageView from "~/components/email-panel/SingleMessageView";
import ThreadMessage from "~/components/email-panel/ThreadMessage";
import MobileQuickActions from "./MobileQuickActions";
import MobileTagSheet from "./MobileTagSheet";

export default function MobileEmailDetail({
	email,
	allMessages,
	mailboxId,
	mailboxEmail,
	folder,
	folders,
	isDraftFolder,
	isDeleting,
	isSending,
	threadActionsDisabled,
	expandedMessages,
	onToggleExpand,
	onBack,
	onArchive,
	onMove,
	onToggleRead,
	onToggleStar,
	onDelete,
	onReply,
	onEditDraft,
	onSendDraft,
	onDeleteDraft,
	onPreviewImage,
}: {
	email: Email;
	allMessages: Email[];
	mailboxId?: string;
	mailboxEmail?: string;
	folder?: string;
	folders: Folder[];
	isDraftFolder: boolean;
	isDeleting: boolean;
	isSending: boolean;
	threadActionsDisabled: boolean;
	expandedMessages: Set<string>;
	onToggleExpand: (id: string) => void;
	onBack: () => void;
	onArchive: () => void;
	onMove: (folderId: string) => void;
	onToggleRead: () => void;
	onToggleStar: () => void;
	onDelete: () => void;
	onReply: () => void;
	onEditDraft: (message?: Email) => void;
	onSendDraft: (message?: Email) => void;
	onDeleteDraft: (message?: Email) => void;
	onPreviewImage: (url: string, filename: string) => void;
}) {
	const [isQuickActionsOpen, setQuickActionsOpen] = useState(false);
	const [isTagsOpen, setTagsOpen] = useState(false);
	const [isMobileViewport, setIsMobileViewport] = useState(false);
	useEffect(() => {
		const media = window.matchMedia("(max-width: 767px)");
		const update = () => setIsMobileViewport(media.matches);
		update();
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);
	const { data: tags = [] } = useEmailTags(mailboxId, email.id, { enabled: isMobileViewport });
	const isArchived = folder === Folders.ARCHIVE || email.folder_id === Folders.ARCHIVE;
	const isTrash = folder === Folders.TRASH || email.folder_id === Folders.TRASH;
	const hasThread = allMessages.length > 1;

	return (
		<div className="flex h-full flex-col bg-kumo-base">
			<div className="flex shrink-0 items-center gap-1 border-b border-kumo-line px-3 py-2">
				<Button variant="ghost" shape="square" size="sm" icon={<ArrowLeftIcon size={19} />} onClick={onBack} aria-label="Back to list" />
				<div className="min-w-0 flex-1" />
				<Button variant="ghost" shape="square" size="sm" icon={<ArchiveIcon size={18} />} onClick={isTrash ? () => onMove(Folders.INBOX) : onArchive} disabled={isDeleting || threadActionsDisabled} aria-label={isTrash ? "Restore to Inbox" : isArchived ? "Move to inbox" : "Archive"} />
				<Button variant="ghost" shape="square" size="sm" icon={<DotsThreeIcon size={21} />} onClick={() => setQuickActionsOpen(true)} aria-label="More actions" />
			</div>

			<div className="shrink-0 border-b border-kumo-line px-4 py-4">
				<h1 className="text-lg font-semibold leading-snug text-kumo-default">{email.subject || "(no subject)"}</h1>
				<div className="mt-3 flex items-center gap-2.5">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-kumo-fill text-xs font-bold text-kumo-default">{email.sender.charAt(0).toUpperCase()}</div>
					<div className="min-w-0 flex-1">
						<div className="truncate text-sm font-medium text-kumo-default">{email.sender}</div>
						<div className="truncate text-xs text-kumo-subtle">To: {email.recipient}</div>
						{email.envelope_recipient && email.envelope_recipient !== email.recipient && <div className="truncate text-xs text-kumo-subtle">Delivered to: {email.envelope_recipient}</div>}
					</div>
					<div className="shrink-0 text-right text-[11px] text-kumo-subtle">
						<div>{formatDetailDate(email.date)}</div>
						{hasThread && <div>{allMessages.length} messages</div>}
					</div>
				</div>
				<div className="mt-3 flex flex-wrap items-center gap-1.5">
					{email.needs_reply && <span className="rounded-full bg-kumo-brand/10 px-2 py-0.5 text-[11px] font-medium text-kumo-brand">Needs reply</span>}
					{email.has_draft && <span className="rounded-full bg-kumo-warning/10 px-2 py-0.5 text-[11px] font-medium text-kumo-warning">Draft</span>}
					{tags.slice(0, 4).map((tag) => <span key={tag.tag} className="rounded-full bg-kumo-fill px-2 py-0.5 text-[11px] text-kumo-subtle">{tag.tag}</span>)}
					<button type="button" onClick={() => setTagsOpen(true)} className="inline-flex items-center gap-1 rounded-full border border-kumo-line px-2 py-0.5 text-[11px] text-kumo-subtle hover:bg-kumo-tint"><TagIcon size={12} /> Edit tags</button>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto pb-20">
				{hasThread ? allMessages.map((message, index) => {
					const isDraft = message.folder_id === Folders.DRAFT || (isDraftFolder && message.id === email.id);
					return <ThreadMessage key={message.id} email={message} mailboxId={mailboxId} mailboxEmail={mailboxEmail} isLast={index === allMessages.length - 1} isDraft={isDraft} isSending={isDraft ? isSending : false} isDeleting={isDeleting} isExpanded={expandedMessages.has(message.id)} onToggleExpand={() => onToggleExpand(message.id)} onSendDraft={isDraft ? () => onSendDraft(message) : undefined} onEditDraft={isDraft ? () => onEditDraft(message) : undefined} onDeleteDraft={isDraft ? () => onDeleteDraft(message) : undefined} onPreviewImage={onPreviewImage} />;
				}) : <SingleMessageView email={email} mailboxId={mailboxId} onPreviewImage={onPreviewImage} showHeader={false} />}
			</div>

			<div className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-kumo-line bg-kumo-base/95 px-4 pb-2 pt-2 backdrop-blur md:hidden">
				{isDraftFolder ? <Button variant="primary" className="flex-1" icon={<PencilSimpleIcon size={16} />} onClick={() => onEditDraft(email)} disabled={isDeleting}>Edit draft</Button> : <Button variant="primary" className="flex-1" icon={<ArrowBendUpLeftIcon size={16} />} onClick={onReply} disabled={isDeleting}>Reply</Button>}
				<Button variant="ghost" shape="square" icon={<StarIcon size={19} weight={email.starred ? "fill" : "regular"} />} onClick={onToggleStar} aria-label={email.starred ? "Unstar" : "Star"} />
			</div>

			<MobileQuickActions open={isQuickActionsOpen} email={email} unread={allMessages.some((message) => !message.read)} isArchived={isArchived} isTrash={isTrash} threadActionsDisabled={threadActionsDisabled} onClose={() => setQuickActionsOpen(false)} onArchive={onArchive} onMoveToInbox={() => onMove(Folders.INBOX)} onToggleRead={onToggleRead} onToggleStar={onToggleStar} onOpenTags={() => { setQuickActionsOpen(false); setTagsOpen(true); }} onDelete={onDelete} />
			<MobileTagSheet open={isTagsOpen} mailboxId={mailboxId} emailId={email.id} onClose={() => setTagsOpen(false)} />
		</div>
	);
}
