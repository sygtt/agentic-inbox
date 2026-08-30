// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useEffect, useRef } from "react";
import { Link, Outlet, useNavigate, useParams } from "react-router";
import AgentSidebar from "~/components/AgentSidebar";
import ComposeEmail from "~/components/ComposeEmail";
import Header from "~/components/Header";
import Sidebar from "~/components/Sidebar";
import { useMailbox } from "~/queries/mailboxes";
import { useUIStore } from "~/hooks/useUIStore";
import MobileBottomNav from "~/components/mobile/MobileBottomNav";

export default function MailboxRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const navigate = useNavigate();
	// Prefetch mailbox data for child components
	const { data: currentMailbox } = useMailbox(mailboxId);
	const prevMailboxIdRef = useRef<string | undefined>(undefined);
	const {
		selectedEmailId,
		isComposing,
		isSidebarOpen,
		closeSidebar,
		isAgentPanelOpen,
		closePanel,
		closeComposeModal,
		startCompose,
	} = useUIStore();
	const openCompose = () => {
		if (mailboxId) navigate(`/mailbox/${mailboxId}/emails/inbox`);
		startCompose();
	};

	useEffect(() => {
		if (
			prevMailboxIdRef.current &&
			mailboxId &&
			prevMailboxIdRef.current !== mailboxId
		) {
			closePanel();
			closeComposeModal();
			closeSidebar();
		}

		prevMailboxIdRef.current = mailboxId;
	}, [mailboxId, closeComposeModal, closePanel, closeSidebar]);

	return (
		<div className="flex h-[100dvh] overflow-hidden">
			{/* Mobile sidebar overlay backdrop */}
			{isSidebarOpen && (
				<div
					className="fixed inset-0 z-30 bg-black/30 md:hidden"
					onClick={closeSidebar}
					onKeyDown={(e) => e.key === "Escape" && closeSidebar()}
					role="button"
					tabIndex={-1}
					aria-label="Close sidebar"
				/>
			)}

			{/* Sidebar: hidden on mobile by default, shown as overlay when open */}
			<div
				className={`hidden md:block fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 md:z-0 ${
					isSidebarOpen ? "translate-x-0" : "-translate-x-full"
				}`}
			>
				<Sidebar />
			</div>

			{/* Main content */}
			<div className="flex-1 flex flex-col min-w-0 bg-kumo-base">
				<div className="mobile-safe-top flex items-center gap-3 border-b border-kumo-line bg-kumo-base px-4 py-3 md:hidden">
					<Link to="/" className="text-sm text-kumo-subtle" aria-label="Back to mailboxes">
						←
					</Link>
					<div className="min-w-0">
						<div className="truncate text-sm font-semibold text-kumo-default">
							{currentMailbox?.settings?.fromName || currentMailbox?.name || mailboxId}
						</div>
						<div className="truncate text-xs text-kumo-subtle">
							{currentMailbox?.email || mailboxId}
						</div>
					</div>
				</div>
				<Header />
				<main className="flex-1 min-h-0 overflow-hidden">
					<Outlet />
				</main>
				<MobileBottomNav
					mailboxId={mailboxId}
					visible={!selectedEmailId && !isComposing}
					onCompose={openCompose}
				/>
			</div>

			{/* Agent + MCP sidebar -- togglable on desktop */}
			{isAgentPanelOpen && (
				<div className="hidden lg:flex w-[380px] shrink-0 border-l border-kumo-line flex-col bg-kumo-base overflow-hidden">
					<AgentSidebar />
				</div>
			)}

			<ComposeEmail />
		</div>
	);
}
