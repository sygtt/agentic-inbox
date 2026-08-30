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
	danger = false,
}: {
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
	danger?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-kumo-tint ${danger ? "text-kumo-destructive" : "text-kumo-default"}`}
		>
			{icon}
			{label}
		</button>
	);
}

export default function MobileQuickActions({
	open,
	email,
	isArchived,
	onClose,
	onArchive,
	onMoveToInbox,
	onToggleRead,
	onToggleStar,
	onOpenTags,
	onDelete,
}: {
	open: boolean;
	email: { read: boolean; starred: boolean };
	isArchived: boolean;
	onClose: () => void;
	onArchive: () => void;
	onMoveToInbox: () => void;
	onToggleRead: () => void;
	onToggleStar: () => void;
	onOpenTags: () => void;
	onDelete: () => void;
}) {
	return (
		<MobileBottomSheet open={open} title="Quick actions" onClose={onClose}>
			<div className="space-y-1">
				<ActionButton
					label={isArchived ? "Move to Inbox" : "Archive"}
					icon={isArchived ? <FolderSimpleIcon size={20} /> : <ArchiveIcon size={20} />}
					onClick={isArchived ? onMoveToInbox : onArchive}
				/>
				<ActionButton
					label={email.read ? "Mark unread" : "Mark read"}
					icon={email.read ? <EnvelopeSimpleIcon size={20} /> : <EnvelopeOpenIcon size={20} />}
					onClick={() => { onToggleRead(); onClose(); }}
				/>
				<ActionButton
					label={email.starred ? "Remove star" : "Star"}
					icon={<StarIcon size={20} weight={email.starred ? "fill" : "regular"} />}
					onClick={() => { onToggleStar(); onClose(); }}
				/>
				<ActionButton label="Tags" icon={<TagIcon size={20} />} onClick={onOpenTags} />
				<ActionButton label="Delete" icon={<TrashIcon size={20} />} onClick={onDelete} danger />
			</div>
		</MobileBottomSheet>
	);
}
