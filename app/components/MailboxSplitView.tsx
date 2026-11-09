// SPDX-License-Identifier: Apache-2.0
// Modified in the sygtt/agentic-inbox fork; see Git history.
// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { ReactNode } from "react";
import ComposePanel from "~/components/ComposePanel";
import EmailPanel from "~/components/EmailPanel";
import { useUIStore } from "~/hooks/useUIStore";
import type { Email } from "~/types";

interface MailboxSplitViewProps {
	selectedEmailId: string | null;
	isComposing: boolean;
	onCloseEmail?: () => void;
	showEmptyDetail?: boolean;
	mobileEmailNavigation?: {
		previousEmailId: string | null;
		nextEmailId: string | null;
		onNavigate: (emailId: string) => void;
		onUrlEmailLoaded: (email: Email) => void;
		onArchiveSuccess: (archivedEmailId: string, nextEmailId: string | null, previousEmailId: string | null) => void;
	};
	children: ReactNode;
}

export default function MailboxSplitView({
	selectedEmailId,
	isComposing,
	onCloseEmail,
	showEmptyDetail = false,
	mobileEmailNavigation,
	children,
}: MailboxSplitViewProps) {
	const closePanel = useUIStore((state) => state.closePanel);
	const closeEmail = onCloseEmail ?? closePanel;
	const navigation = mobileEmailNavigation ?? {
		previousEmailId: null,
		nextEmailId: null,
		onNavigate: () => {},
		onUrlEmailLoaded: () => {},
		onArchiveSuccess: () => closePanel(),
	};
	const isPanelOpen = selectedEmailId !== null || isComposing || showEmptyDetail;

	return (
		<div className="flex h-full">
			<div
				className={`flex flex-col min-w-0 shrink-0 ${
					isPanelOpen
						? `${showEmptyDetail && !selectedEmailId && !isComposing ? "flex" : "hidden"} md:flex md:w-[280px] md:border-r md:border-kumo-line lg:w-[320px] xl:w-[400px] 2xl:w-[440px] md:shrink-0`
						: "w-full"
				}`}
			>
				{children}
			</div>
			{isPanelOpen && (
				<div className={`desktop-detail flex-1 flex-col min-w-0 overflow-hidden w-full md:w-auto ${showEmptyDetail && !selectedEmailId && !isComposing ? "hidden md:flex" : "flex"}`}>
					{isComposing && !selectedEmailId ? (
						<ComposePanel onSendSuccess={closeEmail} />
					) : isComposing && selectedEmailId ? (
						<div className="flex flex-col h-full overflow-y-auto">
							<ComposePanel onSendSuccess={closeEmail} />
							<div className="border-t border-kumo-line">
								<EmailPanel emailId={selectedEmailId} onClose={closeEmail} mobileEmailNavigation={navigation} />
							</div>
						</div>
					) : selectedEmailId ? (
						<EmailPanel emailId={selectedEmailId} onClose={closeEmail} mobileEmailNavigation={navigation} />
					) : <p className="m-auto p-6 text-sm text-kumo-subtle">表示するメールがありません</p>}
				</div>
			)}
		</div>
	);
}
