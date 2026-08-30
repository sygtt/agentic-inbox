// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	GearSixIcon,
	MagnifyingGlassIcon,
	PencilSimpleIcon,
	TrayIcon,
	FolderIcon,
} from "@phosphor-icons/react";
import { NavLink } from "react-router";
import { Folders } from "shared/folders";
import { useFolders } from "~/queries/folders";

export default function MobileBottomNav({
	mailboxId,
	visible,
	onCompose,
}: {
	mailboxId?: string;
	visible: boolean;
	onCompose: () => void;
}) {
	const { data: folders = [] } = useFolders(mailboxId);
	if (!visible || !mailboxId) return null;

	const inboxUnread = folders.find((folder) => folder.id === Folders.INBOX)?.unreadCount ?? 0;
	const links = [
		{ to: `/mailbox/${mailboxId}/emails/inbox`, label: "Inbox", icon: TrayIcon, end: true },
		{ to: `/mailbox/${mailboxId}/folders`, label: "Folders", icon: FolderIcon },
		{ to: `/mailbox/${mailboxId}/search`, label: "Search", icon: MagnifyingGlassIcon },
		{ to: `/mailbox/${mailboxId}/settings`, label: "Settings", icon: GearSixIcon },
	];

	return (
		<nav className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-kumo-line bg-kumo-base/95 px-2 pt-2 backdrop-blur md:hidden" aria-label="Mailbox navigation">
			{links.map(({ to, label, icon: Icon, end }) => (
				<NavLink
					key={to}
					to={to}
					end={end}
					className={({ isActive }) => `relative flex min-h-12 flex-col items-center gap-1 rounded-lg py-1 text-[11px] transition-colors ${isActive ? "font-semibold text-kumo-brand" : "text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default"}`}
				>
					<Icon size={21} weight="regular" />
					<span>{label}</span>
					{label === "Inbox" && inboxUnread > 0 && (
						<span className="absolute right-5 top-0 min-w-4 rounded-full bg-kumo-brand px-1 text-center text-[10px] font-semibold text-kumo-inverse">
							{inboxUnread > 99 ? "99+" : inboxUnread}
						</span>
					)}
				</NavLink>
			))}
			<button
				type="button"
				onClick={onCompose}
				className="relative flex min-h-12 flex-col items-center gap-1 rounded-lg py-1 text-[11px] text-kumo-subtle transition-colors hover:bg-kumo-tint hover:text-kumo-default"
			>
				<PencilSimpleIcon size={21} weight="regular" />
				<span>Compose</span>
			</button>
		</nav>
	);
}
