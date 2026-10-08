// SPDX-License-Identifier: Apache-2.0
// Modified in the sygtt/agentic-inbox fork; see Git history.
// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Pagination, Tooltip, useKumoToastManager } from "@cloudflare/kumo";
import {
	ArchiveIcon,
	ArrowsClockwiseIcon,
	CaretLeftIcon,
	CaretRightIcon,
	EnvelopeSimpleIcon,
	FileIcon,
	PaperPlaneTiltIcon,
	PencilSimpleIcon,
	TrashIcon,
	TrayIcon,
} from "@phosphor-icons/react";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { Folders } from "shared/folders";
import MailboxSplitView from "~/components/MailboxSplitView";
import EmailListRow from "~/components/EmailListRow";
import {
	useDeleteEmail,
	useEmails,
	useMarkThreadRead,
	useMoveEmail,
	useMoveThread,
	useUpdateEmail,
} from "~/queries/emails";
import { useFolders } from "~/queries/folders";
import { queryKeys } from "~/queries/keys";
import { useUIStore } from "~/hooks/useUIStore";
import type { Email } from "~/types";
import MobileEmailRow from "~/components/mobile/MobileEmailRow";
import MobileQuickActions from "~/components/mobile/MobileQuickActions";
import MobileTagSheet from "~/components/mobile/MobileTagSheet";
import {
	getMobileArchiveSuccessAction,
	getMobileEmailNeighborIds,
	getMobileEmailPanelCloseAction,
	getMobileEmailSelectionAction,
	isEmailStillSelected,
	isMobileEmailDetailHistoryEntry,
	shouldMarkUrlSelectedEmailRead,
	withMobileEmailDetailHistoryEntry,
} from "~/lib/mobile-email-navigation";
import EmailTagFilter from "~/components/EmailTagFilter";
import { useAvailableEmailTags } from "~/queries/email-tags";
import { buildEmailListParams, getDesktopListCountLabel, getListPageCount, getListPageRange } from "~/lib/email-tag-filter";
import { getRestoreTargetFolder } from "~/lib/trash-undo";

const PAGE_SIZE = 25;

const FOLDER_EMPTY_STATES: Record<
	string,
	{
		icon: React.ReactNode;
		title: string;
		description: string;
		showCompose?: boolean;
	}
> = {
	[Folders.INBOX]: {
		icon: <TrayIcon size={48} weight="thin" className="text-kumo-subtle" />,
		title: "Your inbox is empty",
		description:
			"New emails will appear here when they arrive. Send an email to get the conversation started.",
		showCompose: true,
	},
	[Folders.SENT]: {
		icon: (
			<PaperPlaneTiltIcon size={48} weight="thin" className="text-kumo-subtle" />
		),
		title: "No sent emails",
		description: "Emails you send will show up here.",
		showCompose: true,
	},
	[Folders.DRAFT]: {
		icon: <FileIcon size={48} weight="thin" className="text-kumo-subtle" />,
		title: "No drafts",
		description: "Emails you're still working on will be saved here.",
		showCompose: true,
	},
	[Folders.ARCHIVE]: {
		icon: <ArchiveIcon size={48} weight="thin" className="text-kumo-subtle" />,
		title: "Archive is empty",
		description:
			"Move emails here to keep your inbox clean without deleting them.",
	},
	[Folders.TRASH]: {
		icon: <TrashIcon size={48} weight="thin" className="text-kumo-subtle" />,
		title: "Trash is empty",
		description:
			"Deleted emails will appear here. You can restore them or permanently delete them.",
	},
};

function EmailListSkeleton() {
	return (
		<div className="animate-pulse space-y-1 p-2">
			{Array.from({ length: 8 }).map((_, i) => (
				<div key={i} className="flex items-center gap-3 px-3 py-3">
					<div className="w-4 h-4 rounded bg-kumo-fill" />
					<div className="w-5 h-5 rounded bg-kumo-fill" />
					<div className="flex-1 space-y-2">
						<div className="flex items-center gap-2">
							<div className="h-3 w-24 rounded bg-kumo-fill" />
							<div className="h-3 w-4 rounded bg-kumo-fill" />
							<div className="h-3 flex-1 rounded bg-kumo-fill" />
							<div className="h-3 w-12 rounded bg-kumo-fill" />
						</div>
						<div className="h-2.5 w-3/4 rounded bg-kumo-fill" />
					</div>
				</div>
			))}
		</div>
	);
}

function FolderEmptyState({
	folder,
	onCompose,
}: {
	folder?: string;
	onCompose: () => void;
}) {
	const config = (folder && FOLDER_EMPTY_STATES[folder]) || {
		icon: (
			<EnvelopeSimpleIcon size={48} weight="thin" className="text-kumo-subtle" />
		),
		title: "No emails",
		description: "This folder is empty.",
	};

	return (
		<div className="flex flex-col items-center justify-center py-24 px-6 text-center">
			<div className="mb-4">{config.icon}</div>
			<h3 className="text-base font-semibold text-kumo-default mb-1.5">
				{config.title}
			</h3>
			<p className="text-sm text-kumo-subtle max-w-xs mb-5">
				{config.description}
			</p>
			{"showCompose" in config && config.showCompose && (
				<Button
					variant="primary"
					size="sm"
					icon={<PencilSimpleIcon size={16} />}
					onClick={onCompose}
				>
					Compose
				</Button>
			)}
		</div>
	);
}

function TagFilterEmptyState({ tag, onClear }: { tag: string; onClear: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center px-6 py-20 text-center">
			<div className="mb-4"><EnvelopeSimpleIcon size={42} weight="thin" className="text-kumo-subtle" /></div>
			<h3 className="text-base font-semibold text-kumo-default">No matching emails</h3>
			<p className="mt-1 max-w-xs break-all text-sm text-kumo-subtle">
				No conversations in this folder have the <span className="font-medium text-kumo-default">{tag}</span> tag.
			</p>
			<button type="button" onClick={onClear} className="mt-4 text-sm font-medium text-kumo-brand underline underline-offset-2">
				Clear tag filter
			</button>
		</div>
	);
}

export default function EmailListRoute() {
	const { mailboxId, folder } = useParams<{
		mailboxId: string;
		folder: string;
	}>();
	const location = useLocation();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const urlSelectedEmailId = searchParams.get("email");
	const {
		selectedEmailId,
		isComposing,
		selectEmail,
		clearEmailSelection,
		closePanel,
		startCompose,
		isSendingEmail: isDraftSending,
	} = useUIStore();
	const [page, setPage] = useState(1);
	const [mobileFilter, setMobileFilter] = useState<"all" | "needs">("all");
	const [selectedTag, setSelectedTag] = useState<string>();
	const [isMobileViewport, setIsMobileViewport] = useState(false);
	const isMobileViewportRef = useRef(false);
	const [quickActionEmail, setQuickActionEmail] = useState<Email | null>(null);
	const [tagsEmail, setTagsEmail] = useState<Email | null>(null);
	const toastManager = useKumoToastManager();

	useEffect(() => {
		const media = window.matchMedia("(max-width: 767px)");
		const update = () => {
			isMobileViewportRef.current = media.matches;
			setIsMobileViewport(media.matches);
		};
		update();
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);

	const queryClient = useQueryClient();
	const updateEmail = useUpdateEmail();
	const markThreadRead = useMarkThreadRead();
	const deleteEmail = useDeleteEmail();
	const moveEmail = useMoveEmail();
	const moveThread = useMoveThread();
	const isDeleting = useIsMutating({ mutationKey: ["deleteEmail"] }) > 0;
	const isSavingDraft = useIsMutating({ mutationKey: ["saveDraft"] }) > 0;
	const isSendingMutation = useIsMutating({ mutationKey: ["sendEmail"] }) > 0;
	const isSendingEmail = isDraftSending || isSendingMutation;
	const setUrlSelectedEmailId = useCallback((emailId: string | null, replace: boolean, markAsMobileDetail = false) => {
		setSearchParams((current) => {
			const next = new URLSearchParams(current);
			if (emailId) next.set("email", emailId);
			else next.delete("email");
			return next;
		}, {
			replace,
			state: markAsMobileDetail
				? withMobileEmailDetailHistoryEntry(location.state)
				: location.state,
		});
	}, [location.state, setSearchParams]);
	const closeEmailPanel = useCallback((returnThroughHistory = true) => {
		const closeAction = getMobileEmailPanelCloseAction({
			urlSelectedEmailId,
			returnThroughHistory,
			locationState: location.state,
		});
		if (closeAction.type === "return-through-history") navigate(-1);
		else if (closeAction.type === "clear-url-selection") setUrlSelectedEmailId(null, true);
		closePanel();
	}, [closePanel, location.state, navigate, setUrlSelectedEmailId, urlSelectedEmailId]);

	const params = useMemo(
		() => buildEmailListParams({
			folder: folder || "",
			page,
			limit: PAGE_SIZE,
			needsReply: isMobileViewport && folder === Folders.INBOX && mobileFilter === "needs",
			tag: selectedTag,
		}),
		[folder, isMobileViewport, mobileFilter, page, selectedTag],
	);

	const {
		data: emailData,
		isFetching: isRefreshing,
		isError,
		refetch,
	} = useEmails(mailboxId, params, { refetchInterval: 30_000 });

	const emails = emailData?.emails ?? [];
	const totalCount = emailData?.totalCount ?? 0;
	const pageCount = getListPageCount(totalCount, PAGE_SIZE);
	const { start: pageStart, end: pageEnd } = getListPageRange(Math.min(page, pageCount), PAGE_SIZE, totalCount);
	const { data: needsReplyData } = useEmails(
		mailboxId,
		{ folder: folder || "", page: "1", limit: "1", needs_reply: "true" },
		{ enabled: folder === Folders.INBOX && isMobileViewport },
	);
	const { data: allFolderData } = useEmails(
		mailboxId,
		{ folder: folder || "", page: "1", limit: "1" },
		{ enabled: !!folder && isMobileViewport },
	);

	const { data: folders = [] } = useFolders(mailboxId);
	const availableTagsQuery = useAvailableEmailTags(mailboxId);
	const availableTags = availableTagsQuery.data ?? [];

	const folderName = useMemo(() => {
		const found = folders.find((f) => f.id === folder);
		if (found) return found.name;
		return folder ? folder.charAt(0).toUpperCase() + folder.slice(1) : "Inbox";
	}, [folders, folder]);

	const mobileEmailNeighbors = useMemo(
		() => getMobileEmailNeighborIds(emails, selectedEmailId),
		[emails, selectedEmailId],
	);
	const wasMobileViewportRef = useRef(false);
	const wasComposingRef = useRef(isComposing);
	const previousUrlSelectedEmailIdRef = useRef(urlSelectedEmailId);
	const wasMobileEmailDetailHistoryEntryRef = useRef(isMobileEmailDetailHistoryEntry(location.state));
	const readMarkedEmailIdRef = useRef<string | null>(null);

	useEffect(() => {
		const action = getMobileEmailSelectionAction({
			isMobileViewport,
			wasMobileViewport: wasMobileViewportRef.current,
			wasComposing: wasComposingRef.current,
			previousUrlSelectedEmailId: previousUrlSelectedEmailIdRef.current,
			urlSelectedEmailId,
			selectedEmailId,
			isComposing,
			wasMobileEmailDetailHistoryEntry: wasMobileEmailDetailHistoryEntryRef.current,
			isCurrentMobileEmailDetailHistoryEntry: isMobileEmailDetailHistoryEntry(location.state),
		});
		wasMobileViewportRef.current = isMobileViewport;
		wasComposingRef.current = isComposing;
		previousUrlSelectedEmailIdRef.current = urlSelectedEmailId;
		wasMobileEmailDetailHistoryEntryRef.current = isMobileEmailDetailHistoryEntry(location.state);

		if (action.type === "select-url-email") selectEmail(action.emailId);
		else if (action.type === "write-selected-email-to-url") setUrlSelectedEmailId(action.emailId, true);
		else if (action.type === "clear-selection") selectEmail(null);
		else if (action.type === "restore-detail-history") navigate(1);
	}, [isMobileViewport, isComposing, location.state, navigate, selectedEmailId, selectEmail, setUrlSelectedEmailId, urlSelectedEmailId]);

	// Track folder identity to detect folder changes vs page changes
	const prevFolderRef = useRef<string | undefined>(undefined);

	useEffect(() => {
		const currentFolder = `${mailboxId}/${folder}`;
		const isInitialFolder = prevFolderRef.current === undefined;
		const folderChanged = prevFolderRef.current !== currentFolder;
		prevFolderRef.current = currentFolder;

		if (folderChanged) {
			if (!isComposing && !(isInitialFolder && urlSelectedEmailId)) closeEmailPanel(false);
			setPage(1);
		}
	}, [mailboxId, folder, isComposing, closeEmailPanel, urlSelectedEmailId]);

	// Archive/delete/refetch can shrink totalCount below the current page; the server
	// then returns an empty page and the folder wrongly renders its empty state.
	useEffect(() => {
		if (!emailData) return;
		const lastPage = getListPageCount(emailData.totalCount, PAGE_SIZE);
		setPage((current) => (current > lastPage ? lastPage : current));
	}, [emailData]);

	const toggleStar = (e: React.MouseEvent, email: Email) => {
		e.preventDefault();
		e.stopPropagation();
		if (mailboxId)
			updateEmail.mutate({
				mailboxId,
				id: email.id,
				data: { starred: !email.starred },
			});
	};

	const deleteById = async (emailId: string) => {
		if (isDeleting || moveEmail.isPending || isSavingDraft || isSendingEmail) return;
		if (mailboxId) {
			const permanent = folder === Folders.TRASH || folder === Folders.DRAFT;
			if (permanent && !window.confirm("Permanently delete this email? This cannot be undone.")) return;
			try {
				if (permanent) {
					await deleteEmail.mutateAsync({ mailboxId, id: emailId });
					toastManager.add({ title: "Email permanently deleted" });
				} else {
					// Prefer the row's own folder: the route folder can be a stale view.
					const sourceFolderId = getRestoreTargetFolder(emails.find((email) => email.id === emailId)?.folder_id, folder) || Folders.INBOX;
					await moveEmail.mutateAsync({ mailboxId, id: emailId, folderId: Folders.TRASH });
					let toastId = "";
					toastId = toastManager.add({
						title: "Email moved to Trash",
						actions: [{
							children: "キャンセル",
							variant: "secondary",
							onClick: async () => {
								try {
									await moveEmail.mutateAsync({ mailboxId, id: emailId, folderId: sourceFolderId });
									toastManager.update(toastId, {
										title: "Email restored",
										actions: [],
										timeout: 2000,
									});
								} catch {
									toastManager.update(toastId, {
										title: "Failed to restore email",
										variant: "error",
										actions: [],
									});
								}
							},
						}],
					});
				}
				if (!isEmailStillSelected(useUIStore.getState().selectedEmailId, emailId)) {
					clearEmailSelection(emailId);
					return;
				}
				if (urlSelectedEmailId === emailId) {
					closeEmailPanel();
				} else {
					clearEmailSelection(emailId);
				}
			} catch {
				toastManager.add({ title: "Failed to delete email", variant: "error" });
			}
		}
	};

	const handleDelete = async (e: React.MouseEvent, emailId: string) => {
		e.preventDefault();
		e.stopPropagation();
		await deleteById(emailId);
	};

	const handleMoveToFolder = async (email: Email, folderId: string) => {
		if (!mailboxId || moveEmail.isPending || moveThread.isPending) return;
		try {
			const sourceFolderId = folder || email.folder_id;
			if (folder !== Folders.DRAFT && (email.thread_count ?? 1) > 1 && sourceFolderId) {
				await moveThread.mutateAsync({ mailboxId, threadId: email.thread_id || email.id, folderId, sourceFolderId });
			} else {
				await moveEmail.mutateAsync({ mailboxId, id: email.id, folderId });
			}
			toastManager.add({ title: folderId === Folders.ARCHIVE ? "Email archived" : "Email moved" });
			return true;
		} catch {
			toastManager.add({ title: "Failed to move email", variant: "error" });
			return false;
		}
	};

	const handleArchive = (email: Email) => handleMoveToFolder(email, folder === Folders.ARCHIVE || folder === Folders.TRASH ? Folders.INBOX : Folders.ARCHIVE);

	const handleRefresh = () => {
		if (mailboxId) {
			queryClient.invalidateQueries({ queryKey: ["emails", mailboxId] });
			queryClient.invalidateQueries({ queryKey: queryKeys.emailTags.available(mailboxId) });
			queryClient.invalidateQueries({
				queryKey: queryKeys.folders.list(mailboxId),
			});
		}
	};

	// Thread-aware helpers
	const hasUnread = (email: Email): boolean => {
		if (email.thread_unread_count !== undefined) {
			return email.thread_unread_count > 0;
		}
		return !email.read;
	};

	const markEmailRead = useCallback((email: Email) => {
		const hasUnreadMessages = email.thread_unread_count !== undefined
			? email.thread_unread_count > 0
			: !email.read;
		if (mailboxId && hasUnreadMessages) {
			if ((email.thread_count ?? 1) > 1) {
				markThreadRead.mutate({
					mailboxId,
					threadId: email.thread_id || email.id,
					folderId: folder || email.folder_id || undefined,
				});
			} else {
				updateEmail.mutate({
					mailboxId,
					id: email.id,
					data: { read: true },
				});
			}
		}
	}, [folder, mailboxId, markThreadRead, updateEmail]);

	const markEmailReadOnce = useCallback((email: Email) => {
		if (readMarkedEmailIdRef.current === email.id) return;
		readMarkedEmailIdRef.current = email.id;
		markEmailRead(email);
	}, [markEmailRead]);

	useEffect(() => {
		if (selectedEmailId !== readMarkedEmailIdRef.current) {
			readMarkedEmailIdRef.current = null;
		}
	}, [selectedEmailId]);

	const handleUrlEmailLoaded = useCallback((email: Email) => {
		if (!shouldMarkUrlSelectedEmailRead({
			isMobileViewport,
			isComposing,
			urlSelectedEmailId,
			selectedEmailId,
			emailId: email.id,
			lastMarkedEmailId: readMarkedEmailIdRef.current,
		})) return;
		markEmailReadOnce(email);
	}, [isComposing, isMobileViewport, markEmailReadOnce, selectedEmailId, urlSelectedEmailId]);

	useEffect(() => {
		if (!urlSelectedEmailId) return;
		const email = emails.find((item) => item.id === urlSelectedEmailId);
		if (email) handleUrlEmailLoaded(email);
	}, [emails, handleUrlEmailLoaded, urlSelectedEmailId]);

	const handleRowClick = (email: Email) => {
		if (isMobileViewport) setUrlSelectedEmailId(email.id, false, true);
		else if (searchParams.has("email")) setUrlSelectedEmailId(null, true);
		selectEmail(email.id);
		markEmailReadOnce(email);
	};

	const navigateMobileEmail = (emailId: string) => {
		setUrlSelectedEmailId(emailId, true);
		selectEmail(emailId);
		const email = emails.find((item) => item.id === emailId);
		if (email) markEmailReadOnce(email);
	};

	const handleArchiveSuccess = (archivedEmailId: string, nextEmailId: string | null) => {
		const action = getMobileArchiveSuccessAction({
			isMobileViewport: isMobileViewportRef.current,
			selectedEmailId: useUIStore.getState().selectedEmailId,
			archivedEmailId,
			nextEmailId,
		});
		if (action.type === "navigate") navigateMobileEmail(action.emailId);
		else if (action.type === "close") closeEmailPanel();
	};

	const handleToggleRead = (email: Email) => {
		if (!mailboxId) return;
		if (hasUnread(email) && (email.thread_count ?? 1) > 1) {
			markThreadRead.mutate({ mailboxId, threadId: email.thread_id || email.id, folderId: folder || email.folder_id || undefined });
			return;
		}
		updateEmail.mutate({ mailboxId, id: email.id, data: { read: !email.read } });
	};

	const needsReplyCount = needsReplyData?.totalCount ?? 0;
	const allFolderCount = allFolderData?.totalCount ?? totalCount;
	const mobileEmails = emails;
	const handleTagSelect = (tag?: string) => {
		setSelectedTag(tag);
		setPage(1);
		closeEmailPanel(false);
	};

	useEffect(() => {
		setPage(1);
	}, [mobileFilter]);

	return (
		<MailboxSplitView
			selectedEmailId={selectedEmailId}
			isComposing={isComposing}
			onCloseEmail={closeEmailPanel}
			mobileEmailNavigation={{
				...mobileEmailNeighbors,
				onNavigate: navigateMobileEmail,
				onUrlEmailLoaded: handleUrlEmailLoaded,
				onArchiveSuccess: handleArchiveSuccess,
			}}
		>
			<>
				<div className="mobile-list flex h-full flex-col bg-kumo-recessed md:hidden">
					<div className="mobile-list-header shrink-0 border-b border-kumo-line bg-kumo-base px-4 pb-3 pt-4">
						<div className="flex items-center justify-between gap-3">
							<div className="min-w-0">
								<h1 className="mobile-title text-xl font-semibold text-kumo-default">{folderName}</h1>
								<p className="mobile-supporting mt-0.5 text-xs text-kumo-subtle">
									{totalCount} conversations · {folders.find((item) => item.id === folder)?.unreadCount ?? 0} unread
								</p>
							</div>
							<Button className="mobile-icon-button" variant="ghost" shape="square" size="sm" icon={<ArrowsClockwiseIcon size={24} className={isRefreshing ? "animate-spin" : ""} />} onClick={handleRefresh} disabled={isRefreshing} aria-label="Refresh" />
						</div>
						<div className="mobile-filters mt-3 flex gap-2 overflow-x-auto pb-1">
							<button type="button" onClick={() => setMobileFilter("all")} aria-pressed={mobileFilter === "all"} className="mobile-chip">All {allFolderCount}</button>
							{needsReplyCount > 0 && <button type="button" onClick={() => setMobileFilter("needs")} aria-pressed={mobileFilter === "needs"} className="mobile-chip">Needs you {needsReplyCount}</button>}
							<EmailTagFilter availableTags={availableTags} selectedTag={selectedTag} isLoading={availableTagsQuery.isPending} isError={availableTagsQuery.isError} onSelect={handleTagSelect} onRetry={() => void availableTagsQuery.refetch()} />
						</div>
					</div>
					<div className="mobile-scroll min-h-0 flex-1 overflow-y-auto pb-20" aria-busy={isRefreshing}>
						{isRefreshing && emails.length === 0 ? <EmailListSkeleton /> : isError ? <p className="m-4 rounded-lg bg-kumo-destructive/10 p-3 text-sm text-kumo-destructive" role="alert">Could not load this folder.</p> : mobileEmails.length > 0 ? mobileEmails.map((email) => <MobileEmailRow key={email.id} email={email} selected={selectedEmailId === email.id} onOpen={() => handleRowClick(email)} onArchive={() => handleArchive(email)} onToggleRead={() => handleToggleRead(email)} onToggleStar={() => updateEmail.mutate({ mailboxId: mailboxId!, id: email.id, data: { starred: !email.starred } })} onLongPress={() => setQuickActionEmail(email)} />) : selectedTag ? <TagFilterEmptyState tag={selectedTag} onClear={() => handleTagSelect(undefined)} /> : <FolderEmptyState folder={folder} onCompose={() => startCompose()} />}
					</div>
					{totalCount > PAGE_SIZE && <div className="mobile-pager mb-20 flex justify-center border-t border-kumo-line bg-kumo-base py-3"><Pagination page={page} setPage={setPage} perPage={PAGE_SIZE} totalCount={totalCount} /></div>}
				</div>
				<div className="desktop-list hidden h-full min-w-0 flex-col md:flex">
				{/* Folder header */}
				<div className="desktop-list-toolbar flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-kumo-line bg-kumo-base px-4 py-2.5 shrink-0 md:px-5">
					<h1 className="desktop-list-title truncate text-base font-semibold text-kumo-default">{folderName}</h1>
					{totalCount > 0 && (
						<span className="desktop-list-count text-xs text-kumo-subtle">
							{getDesktopListCountLabel(totalCount, folders.find((item) => item.id === folder)?.unreadCount ?? 0, selectedTag)}
						</span>
					)}
					<div className="desktop-list-filter min-w-0">
						<EmailTagFilter availableTags={availableTags} selectedTag={selectedTag} isLoading={availableTagsQuery.isPending} isError={availableTagsQuery.isError} onSelect={handleTagSelect} onRetry={() => void availableTagsQuery.refetch()} />
					</div>
					<div className="desktop-list-actions ml-auto flex shrink-0 items-center gap-1">
						<Tooltip
							content={isRefreshing ? "Refreshing..." : "Refresh"}
							side="bottom"
							asChild
						>
							<Button
								variant="ghost"
								shape="square"
								size="sm"
								icon={
									<ArrowsClockwiseIcon
										size={18}
										className={isRefreshing ? "animate-spin" : ""}
									/>
								}
								onClick={handleRefresh}
								disabled={isRefreshing}
								aria-label="Refresh"
							/>
						</Tooltip>
						{totalCount > PAGE_SIZE && (
							<>
								<Button
									variant="ghost"
									shape="square"
									size="sm"
									icon={<CaretLeftIcon size={18} />}
									disabled={page <= 1}
									aria-label="Previous page"
									onClick={() => setPage((current) => current - 1)}
								/>
								<span className="whitespace-nowrap text-xs text-kumo-subtle tabular-nums">
									{pageStart}–{pageEnd} of {totalCount}
								</span>
								<Button
									variant="ghost"
									shape="square"
									size="sm"
									icon={<CaretRightIcon size={18} />}
									disabled={pageEnd >= totalCount}
									aria-label="Next page"
									onClick={() => setPage((current) => current + 1)}
								/>
							</>
						)}
					</div>
				</div>

				{/* Email rows */}
				<div className="desktop-list-scroll min-h-0 flex-1 overflow-y-auto" aria-busy={isRefreshing}>
					{isRefreshing && <span className="sr-only" role="status">Loading emails</span>}
					{isRefreshing && emails.length === 0 ? (
						<EmailListSkeleton />
					) : isError ? (
						<div className="m-4 rounded-lg bg-kumo-destructive/10 p-3 text-sm text-kumo-destructive" role="alert">
							<p>Could not load this folder.</p>
							<Button variant="secondary" size="sm" className="mt-2" onClick={() => void refetch()} disabled={isRefreshing}>
								Retry
							</Button>
						</div>
					) : emails.length > 0 ? (
						<div>
							{emails.map((email) => (
								<EmailListRow
									key={email.id}
									email={email}
									isSelected={selectedEmailId === email.id}
									folder={folder}
									isBusy={isDeleting || isSavingDraft || isSendingEmail}
									onOpen={handleRowClick}
									onToggleStar={toggleStar}
									onToggleRead={handleToggleRead}
									onArchive={async (archivedEmail) => {
										const moved = await handleArchive(archivedEmail);
										if (moved && useUIStore.getState().selectedEmailId === archivedEmail.id) closeEmailPanel();
									}}
									onDelete={handleDelete}
								/>
							))}
						</div>
					) : (
						selectedTag ? <TagFilterEmptyState tag={selectedTag} onClear={() => handleTagSelect(undefined)} /> : <FolderEmptyState folder={folder} onCompose={() => startCompose()} />
					)}
				</div>
				</div>
				<MobileQuickActions
					open={quickActionEmail !== null}
					email={quickActionEmail || { read: false, starred: false }}
					isArchived={folder === Folders.ARCHIVE}
					isTrash={folder === Folders.TRASH}
					onClose={() => setQuickActionEmail(null)}
					onArchive={() => { if (quickActionEmail) void handleArchive(quickActionEmail); setQuickActionEmail(null); }}
					onMoveToInbox={() => { if (quickActionEmail) void handleMoveToFolder(quickActionEmail, Folders.INBOX); setQuickActionEmail(null); }}
					onToggleRead={() => { if (quickActionEmail) handleToggleRead(quickActionEmail); setQuickActionEmail(null); }}
					onToggleStar={() => { if (quickActionEmail && mailboxId) updateEmail.mutate({ mailboxId, id: quickActionEmail.id, data: { starred: !quickActionEmail.starred } }); setQuickActionEmail(null); }}
					onOpenTags={() => { setTagsEmail(quickActionEmail); setQuickActionEmail(null); }}
					onDelete={() => { if (quickActionEmail) void deleteById(quickActionEmail.id); setQuickActionEmail(null); }}
				/>
				{tagsEmail && <MobileTagSheet open mailboxId={mailboxId} emailId={tagsEmail.id} emailSubject={tagsEmail.subject} emailSender={tagsEmail.sender} onClose={() => setTagsEmail(null)} />}
			</>
		</MailboxSplitView>
	);
}
