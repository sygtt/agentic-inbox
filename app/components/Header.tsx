// SPDX-License-Identifier: Apache-2.0
// Modified in the sygtt/agentic-inbox fork; see Git history.
// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Tooltip } from "@cloudflare/kumo";
import { MagnifyingGlassIcon, RobotIcon, XIcon } from "@phosphor-icons/react";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { useUIStore } from "~/hooks/useUIStore";

export default function Header() {
	const [searchQuery, setSearchQuery] = useState("");
	const [isSearchExpanded, setIsSearchExpanded] = useState(false);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const searchContainerRef = useRef<HTMLDivElement>(null);
	const headerRef = useRef<HTMLElement>(null);
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const { toggleAgentPanel, isAgentPanelOpen } = useUIStore();

	const urlQuery = searchParams.get("q") || "";
	useEffect(() => {
		if (location.pathname.includes("/search")) setSearchQuery(urlQuery);
	}, [urlQuery, location.pathname]);

	useEffect(() => {
		const handleSearchShortcut = (event: globalThis.KeyboardEvent) => {
			if (event.key !== "/" || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
			if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]")) return;
			if (!headerRef.current?.getClientRects().length) return;
			event.preventDefault();
			setIsSearchExpanded(true);
		};
		window.addEventListener("keydown", handleSearchShortcut);
		return () => window.removeEventListener("keydown", handleSearchShortcut);
	}, []);

	useEffect(() => {
		if (isSearchExpanded) searchInputRef.current?.focus();
	}, [isSearchExpanded]);

	useEffect(() => {
		if (!isSearchExpanded) return;
		const closeOnOutsideClick = (event: PointerEvent) => {
			if (event.target instanceof Node && !searchContainerRef.current?.contains(event.target)) {
				setIsSearchExpanded(false);
			}
		};
		document.addEventListener("pointerdown", closeOnOutsideClick);
		return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
	}, [isSearchExpanded]);

	const performSearch = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!mailboxId || !searchQuery.trim()) return;
		navigate(`/mailbox/${mailboxId}/search?q=${encodeURIComponent(searchQuery.trim())}`);
		setIsSearchExpanded(false);
	};

	const clearSearch = () => {
		setSearchQuery("");
		if (location.pathname.includes("/search") && mailboxId) navigate(`/mailbox/${mailboxId}/emails/inbox`);
		searchInputRef.current?.focus();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Escape") {
			event.stopPropagation();
			if (searchQuery) clearSearch();
			else setIsSearchExpanded(false);
		}
	};

	return (
		<header ref={headerRef} className="desktop-header hidden md:flex items-center gap-3 border-b border-kumo-line bg-kumo-base px-5">
			<div className="desktop-brand flex items-center gap-2 text-sm font-semibold tracking-tight text-kumo-default">
				<span className="desktop-brand-mark" aria-hidden="true" />
				Agentic Inbox
			</div>
			<div className="ml-auto flex items-center gap-1">
				<div ref={searchContainerRef} className="relative">
					<Tooltip content="Search mail (/)" side="bottom" asChild>
						<Button
							variant={isSearchExpanded ? "secondary" : "ghost"}
							shape="square"
							icon={<MagnifyingGlassIcon size={20} />}
							onClick={() => setIsSearchExpanded((current) => !current)}
							aria-label="Search mail"
							aria-expanded={isSearchExpanded}
							aria-controls="desktop-search-popover"
						/>
					</Tooltip>
					{isSearchExpanded && (
						<div id="desktop-search-popover" className="desktop-search-popover absolute right-0 top-full z-30 mt-3 rounded-xl border border-kumo-line bg-kumo-base p-3 shadow-lg">
							<form onSubmit={performSearch} className="desktop-search-form flex items-center gap-2 rounded-lg border border-kumo-line px-3">
								<MagnifyingGlassIcon size={18} className="shrink-0 text-kumo-subtle" />
								<input
									ref={searchInputRef}
									className="desktop-search-input min-w-0 flex-1 bg-transparent text-sm text-kumo-default"
									aria-label="Search emails"
									placeholder="メールを検索"
									value={searchQuery}
									onChange={(event) => setSearchQuery(event.target.value)}
									onKeyDown={handleKeyDown}
								/>
								{searchQuery && (
									<button type="button" onClick={clearSearch} aria-label="Clear search" className="shrink-0 p-1 text-kumo-subtle">
										<XIcon size={16} />
									</button>
								)}
								<button type="submit" disabled={!searchQuery.trim()} className="desktop-search-submit shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold">
									検索
								</button>
							</form>
							<p className="mt-2 px-1 text-xs text-kumo-subtle">例: from:name · is:unread · has:attachment</p>
						</div>
					)}
				</div>
				<Tooltip content={isAgentPanelOpen ? "Hide agent panel" : "Show agent panel"} side="bottom" asChild>
					<Button
						variant={isAgentPanelOpen ? "secondary" : "ghost"}
						shape="square"
						icon={<RobotIcon size={20} />}
						onClick={toggleAgentPanel}
						aria-label="Toggle agent panel"
						className="desktop-agent-toggle"
						aria-expanded={isAgentPanelOpen}
						aria-controls="desktop-agent-panel"
					/>
				</Tooltip>
			</div>
		</header>
	);
}
