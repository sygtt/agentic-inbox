// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	ArchiveIcon,
	EnvelopeOpenIcon,
	EnvelopeSimpleIcon,
	FolderSimpleIcon,
	StarIcon,
	TagIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import MobileBottomSheet from "./MobileBottomSheet";

function ActionButton({
	label,
	icon,
	onClick,
	disabled = false,
	danger = false,
}: {
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
	disabled?: boolean;
	danger?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-kumo-tint disabled:cursor-not-allowed disabled:opacity-50 ${danger ? "text-kumo-destructive" : "text-kumo-default"}`}
		>
			{icon}
			{label}
		</button>
	);
}

export default function MobileQuickActions({
	open,
	email,
	unread: unreadOverride,
	isArchived,
	isTrash = false,
	threadActionsDisabled = false,
	onClose,
	onArchive,
	onMoveToInbox,
	onToggleRead,
	onToggleStar,
	onOpenTags,
	onDelete,
}: {
	open: boolean;
	email: { read: boolean; starred: boolean; thread_unread_count?: number };
	unread?: boolean;
	isArchived: boolean;
	isTrash?: boolean;
	threadActionsDisabled?: boolean;
	onClose: () => void;
	onArchive: () => void;
	onMoveToInbox: () => void;
	onToggleRead: () => void;
	onToggleStar: () => void;
	onOpenTags: () => void;
	onDelete: () => void;
}) {
	const unread = unreadOverride ?? (email.thread_unread_count !== undefined ? email.thread_unread_count > 0 : !email.read);
	return (
		<MobileBottomSheet open={open} title="Quick actions" onClose={onClose}>
			<div className="space-y-1">
				<ActionButton
					label={isTrash ? "Restore to Inbox" : isArchived ? "Move to Inbox" : "Archive"}
					icon={isTrash || isArchived ? <FolderSimpleIcon size={20} /> : <ArchiveIcon size={20} />}
					onClick={isTrash || isArchived ? onMoveToInbox : onArchive}
					disabled={threadActionsDisabled}
				/>
				<ActionButton
					label={unread ? "Mark read" : "Mark unread"}
					icon={unread ? <EnvelopeOpenIcon size={20} /> : <EnvelopeSimpleIcon size={20} />}
					onClick={() => { onToggleRead(); onClose(); }}
					disabled={threadActionsDisabled}
				/>
				<ActionButton
					label={email.starred ? "Remove star" : "Star"}
					icon={<StarIcon size={20} weight={email.starred ? "fill" : "regular"} />}
					onClick={() => { onToggleStar(); onClose(); }}
				/>
				<ActionButton label="Tags" icon={<TagIcon size={20} />} onClick={onOpenTags} />
				<ActionButton label={isTrash ? "Delete permanently" : "Delete"} icon={<TrashIcon size={20} />} onClick={onDelete} danger />
			</div>
		</MobileBottomSheet>
	);
}
