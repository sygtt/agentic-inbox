// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Pagination, Tooltip, useKumoToastManager } from "@cloudflare/kumo";
import {
	ArchiveIcon,
	ArrowBendUpLeftIcon,
	ArrowsClockwiseIcon,
	EnvelopeOpenIcon,
	EnvelopeSimpleIcon,
	FileIcon,
	PaperPlaneTiltIcon,
	PencilSimpleIcon,
	StarIcon,
	TrashIcon,
	TrayIcon,
} from "@phosphor-icons/react";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { Folders } from "shared/folders";
import { formatListDate } from "shared/dates";
import MailboxSplitView from "~/components/MailboxSplitView";
import { getSnippetText } from "~/lib/utils";
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

export default function EmailListRoute() {
	const { mailboxId, folder } = useParams<{
		mailboxId: string;
		folder: string;
	}>();
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
	const [quickActionEmail, setQuickActionEmail] = useState<Email | null>(null);
	const [tagsEmail, setTagsEmail] = useState<Email | null>(null);
	const toastManager = useKumoToastManager();

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

	const params = useMemo(
		() => ({
			folder: folder || "",
			page: String(page),
			limit: String(PAGE_SIZE),
			...(mobileFilter === "needs" ? { needs_reply: "true" } : {}),
		}),
		[folder, mobileFilter, page],
	);

	const {
		data: emailData,
		isFetching: isRefreshing,
		isError,
	} = useEmails(mailboxId, params, { refetchInterval: 30_000 });

	const emails = emailData?.emails ?? [];
	const totalCount = emailData?.totalCount ?? 0;
	const { data: needsReplyData } = useEmails(
		mailboxId,
		{ folder: folder || "", page: "1", limit: "1", needs_reply: "true" },
		{ enabled: folder === Folders.INBOX },
	);

	const { data: folders = [] } = useFolders(mailboxId);

	const folderName = useMemo(() => {
		const found = folders.find((f) => f.id === folder);
		if (found) return found.name;
		return folder ? folder.charAt(0).toUpperCase() + folder.slice(1) : "Inbox";
	}, [folders, folder]);

	const isPanelOpen = selectedEmailId !== null || isComposing;

	// Track folder identity to detect folder changes vs page changes
	const prevFolderRef = useRef<string | undefined>(undefined);

	useEffect(() => {
		const folderChanged = prevFolderRef.current !== `${mailboxId}/${folder}`;
		prevFolderRef.current = `${mailboxId}/${folder}`;

		if (folderChanged) {
			closePanel();
			setPage(1);
		}
	}, [mailboxId, folder, closePanel]);

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
		if (isDeleting || isSavingDraft || isSendingEmail) return;
		if (mailboxId) {
			const confirmed = window.confirm("Are you sure you want to delete this email?");
			if (!confirmed) return;
			try {
				await deleteEmail.mutateAsync({ mailboxId, id: emailId });
				toastManager.add({ title: "Email deleted" });
				clearEmailSelection(emailId);
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
			if ((email.thread_count ?? 1) > 1) {
				await moveThread.mutateAsync({ mailboxId, threadId: email.thread_id || email.id, folderId });
			} else {
				await moveEmail.mutateAsync({ mailboxId, id: email.id, folderId });
			}
			toastManager.add({ title: folderId === Folders.ARCHIVE ? "Email archived" : "Email moved" });
		} catch {
			toastManager.add({ title: "Failed to move email", variant: "error" });
		}
	};

	const handleArchive = (email: Email) => handleMoveToFolder(email, Folders.ARCHIVE);

	const handleRefresh = () => {
		if (mailboxId) {
			queryClient.invalidateQueries({ queryKey: ["emails", mailboxId] });
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

	const handleRowClick = (email: Email) => {
		selectEmail(email.id);
		if (mailboxId && hasUnread(email)) {
			if (email.thread_id && email.thread_count && email.thread_count > 1) {
				markThreadRead.mutate({
					mailboxId,
					threadId: email.thread_id,
				});
			} else {
				updateEmail.mutate({
					mailboxId,
					id: email.id,
					data: { read: true },
				});
			}
		}
	};

	const handleToggleRead = (email: Email) => {
		if (!mailboxId) return;
		if (hasUnread(email) && email.thread_id && (email.thread_count ?? 1) > 1) {
			markThreadRead.mutate({ mailboxId, threadId: email.thread_id });
			return;
		}
		updateEmail.mutate({ mailboxId, id: email.id, data: { read: !email.read } });
	};

	const formatParticipants = (email: Email): string => {
		if (email.participants) {
			const names = email.participants
				.split(",")
				.map((p) => p.trim().split("@")[0])
				.filter((name, idx, arr) => arr.indexOf(name) === idx);
			if (names.length <= 3) return names.join(", ");
			return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
		}
		return email.sender.split("@")[0];
	};

	const needsReplyCount = needsReplyData?.totalCount ?? 0;
	const mobileEmails = emails;

	return (
		<MailboxSplitView
			selectedEmailId={selectedEmailId}
			isComposing={isComposing}
		>
			<>
				<div className="flex h-full flex-col bg-kumo-recessed md:hidden">
					<div className="shrink-0 border-b border-kumo-line bg-kumo-base px-4 pb-3 pt-4">
						<div className="flex items-center justify-between gap-3">
							<div>
								<h1 className="text-xl font-semibold text-kumo-default">{folderName}</h1>
								<p className="mt-0.5 text-xs text-kumo-subtle">
									{totalCount} conversations · {folders.find((item) => item.id === folder)?.unreadCount ?? 0} unread
								</p>
							</div>
							<Button variant="ghost" shape="square" size="sm" icon={<ArrowsClockwiseIcon size={18} className={isRefreshing ? "animate-spin" : ""} />} onClick={handleRefresh} disabled={isRefreshing} aria-label="Refresh" />
						</div>
						<div className="mt-3 flex gap-2 overflow-x-auto pb-1">
							<button type="button" onClick={() => setMobileFilter("all")} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${mobileFilter === "all" ? "bg-kumo-brand text-kumo-inverse" : "bg-kumo-fill text-kumo-subtle"}`}>All {totalCount}</button>
							{needsReplyCount > 0 && <button type="button" onClick={() => setMobileFilter("needs")} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${mobileFilter === "needs" ? "bg-kumo-brand text-kumo-inverse" : "bg-kumo-fill text-kumo-subtle"}`}>Needs you {needsReplyCount}</button>}
						</div>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto pb-20">
						{isRefreshing && emails.length === 0 ? <EmailListSkeleton /> : isError ? <p className="m-4 rounded-lg bg-kumo-destructive/10 p-3 text-sm text-kumo-destructive">Could not load this folder.</p> : mobileEmails.length > 0 ? mobileEmails.map((email) => <MobileEmailRow key={email.id} email={email} selected={selectedEmailId === email.id} onOpen={() => handleRowClick(email)} onArchive={() => handleArchive(email)} onToggleRead={() => handleToggleRead(email)} onToggleStar={() => updateEmail.mutate({ mailboxId: mailboxId!, id: email.id, data: { starred: !email.starred } })} onLongPress={() => setQuickActionEmail(email)} />) : <FolderEmptyState folder={folder} onCompose={() => startCompose()} />}
					</div>
					{totalCount > PAGE_SIZE && <div className="flex justify-center border-t border-kumo-line bg-kumo-base py-3"><Pagination page={page} setPage={setPage} perPage={PAGE_SIZE} totalCount={totalCount} /></div>}
				</div>
				<div className="hidden h-full flex-col md:flex">
				{/* Folder header */}
				<div className="flex items-center justify-between px-4 py-3.5 border-b border-kumo-line shrink-0 md:px-5">
					<h1 className="text-lg font-semibold text-kumo-default">
						{folderName}
					</h1>
					<div className="flex items-center gap-1">
						{totalCount > 0 && (
							<span className="text-sm text-kumo-subtle mr-2 hidden sm:inline">
								{totalCount} conversation{totalCount !== 1 ? "s" : ""}
							</span>
						)}
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
					</div>
				</div>

				{/* Email rows */}
				<div className="flex-1 overflow-y-auto">
				{isRefreshing && emails.length === 0 ? (
					<EmailListSkeleton />
				) : emails.length > 0 ? (
						<div>
							{emails.map((email) => {
								const isSelected = selectedEmailId === email.id;
								const snippet = getSnippetText(email.snippet);
								return (
									<div
										key={email.id}
										role="button"
										tabIndex={0}
										onClick={() => handleRowClick(email)}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												handleRowClick(email);
											}
										}}
										className={`group flex items-center gap-3 w-full text-left cursor-pointer transition-colors border-b border-kumo-line px-4 py-2.5 md:px-6 md:py-3 ${
											isPanelOpen ? "md:px-4 md:py-2.5" : ""
										} ${isSelected ? "bg-kumo-tint" : "hover:bg-kumo-tint"}`}
									>
										{/* Unread dot */}
										<div className="w-2.5 shrink-0 flex justify-center">
											{hasUnread(email) && (
												<div className="h-2 w-2 rounded-full bg-kumo-brand" />
											)}
										</div>

										{/* Star */}
										<button
											type="button"
											className="shrink-0 p-0.5 bg-transparent border-0 cursor-pointer"
											onClick={(e) => {
												e.stopPropagation();
												toggleStar(e, email);
											}}
										>
											<StarIcon
												size={16}
												weight={email.starred ? "fill" : "regular"}
												className={
													email.starred
														? "text-kumo-warning"
														: "text-kumo-subtle hover:text-kumo-warning"
												}
											/>
										</button>

										{/* Content */}
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<span
													className={`truncate text-sm ${hasUnread(email) ? "font-semibold text-kumo-default" : "text-kumo-strong"}`}
												>
													{formatParticipants(email)}
												</span>
												{(email.thread_count ?? 1) > 1 && (
													<span className="shrink-0 text-xs text-kumo-subtle bg-kumo-fill rounded-full px-1.5 py-0.5 font-medium">
														{email.thread_count}
													</span>
												)}
												{email.has_draft && (
													<span className="shrink-0 text-xs text-kumo-destructive font-medium">
														Draft
													</span>
												)}
												{email.needs_reply && !email.has_draft && (
													<Tooltip content="Needs reply" asChild>
														<span className="shrink-0 text-kumo-warning">
															<ArrowBendUpLeftIcon size={14} weight="bold" />
														</span>
													</Tooltip>
												)}
												<span className="text-sm text-kumo-subtle shrink-0 ml-auto">
													{formatListDate(email.date)}
												</span>
											</div>
											<div className="truncate text-sm mt-0.5">
												<span
													className={hasUnread(email) ? "font-medium text-kumo-default" : "text-kumo-subtle"}
												>
													{email.subject}
												</span>
											{snippet && (
												<span className="text-kumo-subtle font-normal">
													{" "}&mdash; {snippet}
												</span>
											)}
										</div>
									</div>

										{/* Hover actions */}
										<div className="flex md:hidden md:group-hover:flex items-center shrink-0">
											<Tooltip content={email.read ? "Mark unread" : "Mark read"} asChild>
												<Button
													variant="ghost"
													shape="square"
													size="sm"
													icon={email.read ? <EnvelopeSimpleIcon size={14} /> : <EnvelopeOpenIcon size={14} />}
													onClick={(e) => {
														e.stopPropagation();
														if (mailboxId)
															updateEmail.mutate({
																mailboxId,
																id: email.id,
																data: { read: !email.read },
															});
													}}
													aria-label={email.read ? "Mark unread" : "Mark read"}
												/>
											</Tooltip>
											<Tooltip content="Delete" asChild>
												<Button
													variant="ghost"
													shape="square"
													size="sm"
															icon={<TrashIcon size={14} />}
															onClick={(e) => handleDelete(e, email.id)}
															disabled={isDeleting || isSavingDraft || isSendingEmail}
													aria-label="Delete"
												/>
											</Tooltip>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<FolderEmptyState
							folder={folder}
							onCompose={() => startCompose()}
						/>
					)}
				</div>

				{/* Pagination */}
				{totalCount > PAGE_SIZE && (
					<div className="flex justify-center py-3 border-t border-kumo-line shrink-0">
						<Pagination
							page={page}
							setPage={setPage}
							perPage={PAGE_SIZE}
							totalCount={totalCount}
						/>
					</div>
				)}
				</div>
				<MobileQuickActions
					open={quickActionEmail !== null}
					email={quickActionEmail || { read: false, starred: false }}
					isArchived={folder === Folders.ARCHIVE}
					onClose={() => setQuickActionEmail(null)}
					onArchive={() => { if (quickActionEmail) void handleArchive(quickActionEmail); setQuickActionEmail(null); }}
					onMoveToInbox={() => { if (quickActionEmail) void handleMoveToFolder(quickActionEmail, Folders.INBOX); setQuickActionEmail(null); }}
					onToggleRead={() => { if (quickActionEmail) handleToggleRead(quickActionEmail); setQuickActionEmail(null); }}
					onToggleStar={() => { if (quickActionEmail && mailboxId) updateEmail.mutate({ mailboxId, id: quickActionEmail.id, data: { starred: !quickActionEmail.starred } }); setQuickActionEmail(null); }}
					onOpenTags={() => { setTagsEmail(quickActionEmail); setQuickActionEmail(null); }}
					onDelete={() => { if (quickActionEmail) void deleteById(quickActionEmail.id); setQuickActionEmail(null); }}
				/>
				{tagsEmail && <MobileTagSheet open mailboxId={mailboxId} emailId={tagsEmail.id} onClose={() => setTagsEmail(null)} />}
			</>
		</MailboxSplitView>
	);
}
