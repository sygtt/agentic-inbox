// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Input, Loader, useKumoToastManager } from "@cloudflare/kumo";
import {
	ArchiveIcon,
	FileIcon,
	FolderIcon,
	PencilSimpleIcon,
	PlusIcon,
	TrashIcon,
	PaperPlaneTiltIcon,
	TrayIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { NavLink, useParams } from "react-router";
import { Folders, SYSTEM_FOLDER_IDS, getFolderDisplayName } from "shared/folders";
import { useCreateFolder, useDeleteFolder, useFolders, useUpdateFolder } from "~/queries/folders";

const FOLDER_ICONS: Record<string, React.ReactNode> = {
	[Folders.INBOX]: <TrayIcon size={21} />,
	[Folders.SENT]: <PaperPlaneTiltIcon size={21} />,
	[Folders.DRAFT]: <FileIcon size={21} />,
	[Folders.ARCHIVE]: <ArchiveIcon size={21} />,
	[Folders.TRASH]: <TrashIcon size={21} />,
};

export default function FoldersRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const { data: folders = [], isLoading, isError } = useFolders(mailboxId);
	const createFolder = useCreateFolder();
	const updateFolder = useUpdateFolder();
	const deleteFolder = useDeleteFolder();
	const toast = useKumoToastManager();
	const [newFolderName, setNewFolderName] = useState("");
	const customFolders = useMemo(() => folders.filter((folder) => !(SYSTEM_FOLDER_IDS as readonly string[]).includes(folder.id) && folder.id !== Folders.SPAM), [folders]);
	const visibleSystemFolders = folders.filter((folder) => (SYSTEM_FOLDER_IDS as readonly string[]).includes(folder.id) || folder.id === Folders.SPAM);

	const create = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!mailboxId || !newFolderName.trim()) return;
		try {
			await createFolder.mutateAsync({ mailboxId, name: newFolderName.trim() });
			setNewFolderName("");
			toast.add({ title: "Folder created" });
		} catch (error) {
			toast.add({ title: error instanceof Error ? error.message : "Could not create folder", variant: "error" });
		}
	};

	const rename = async (id: string, currentName: string) => {
		const name = window.prompt("Rename folder", currentName)?.trim();
		if (!mailboxId || !name || name === currentName) return;
		try {
			await updateFolder.mutateAsync({ mailboxId, id, name });
			toast.add({ title: "Folder renamed" });
		} catch (error) {
			toast.add({ title: error instanceof Error ? error.message : "Could not rename folder", variant: "error" });
		}
	};

	const remove = async (id: string, name: string) => {
		if (!mailboxId || !window.confirm(`Delete the ${name} folder?`)) return;
		try {
			await deleteFolder.mutateAsync({ mailboxId, id });
			toast.add({ title: "Folder deleted" });
		} catch (error) {
			toast.add({ title: error instanceof Error ? error.message : "Could not delete folder", variant: "error" });
		}
	};

	return (
		<div className="h-full max-w-2xl overflow-y-auto bg-kumo-recessed px-4 pb-24 pt-4 md:bg-kumo-base md:px-8 md:py-6">
			<div className="mb-5">
				<h1 className="text-xl font-semibold text-kumo-default">Folders</h1>
				<p className="mt-1 text-sm text-kumo-subtle">Your mailbox, organized.</p>
			</div>
			{isLoading ? <div className="flex justify-center py-12"><Loader size="lg" /></div> : isError ? <p className="rounded-lg bg-kumo-destructive/10 p-3 text-sm text-kumo-destructive">Could not load folders.</p> : (
				<div className="space-y-2">
					{visibleSystemFolders.map((folder) => <FolderRow key={folder.id} id={folder.id} name={getFolderDisplayName(folder.id)} count={folder.unreadCount} mailboxId={mailboxId} />)}
					{customFolders.length > 0 && <div className="pt-4 text-xs font-semibold uppercase tracking-wide text-kumo-subtle">Custom folders</div>}
					{customFolders.map((folder) => <FolderRow key={folder.id} id={folder.id} name={folder.name} count={folder.unreadCount} mailboxId={mailboxId} custom onRename={() => rename(folder.id, folder.name)} onDelete={() => remove(folder.id, folder.name)} />)}
					{visibleSystemFolders.length === 0 && customFolders.length === 0 && <p className="py-8 text-center text-sm text-kumo-subtle">No folders available.</p>}
				</div>
			)}
			<form onSubmit={create} className="mt-6 flex items-end gap-2 rounded-xl border border-kumo-line bg-kumo-base p-3">
				<div className="min-w-0 flex-1"><Input label="New folder" placeholder="Projects" value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} /></div>
				<Button type="submit" variant="secondary" icon={<PlusIcon size={16} />} disabled={!newFolderName.trim() || createFolder.isPending}>Add</Button>
			</form>
		</div>
	);
}

function FolderRow({
	id,
	name,
	count,
	mailboxId,
	custom,
	onRename,
	onDelete,
}: {
	id: string;
	name: string;
	count: number;
	mailboxId?: string;
	custom?: boolean;
	onRename?: () => void;
	onDelete?: () => void;
}) {
	return <div className="flex items-center gap-2 rounded-xl border border-kumo-line bg-kumo-base px-3 py-1">
		<NavLink to={`/mailbox/${mailboxId}/emails/${id}`} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-sm text-kumo-default">
			<span className="text-kumo-brand">{FOLDER_ICONS[id] || <FolderIcon size={21} />}</span>
			<span className="min-w-0 flex-1 truncate">{name}</span>
			{count > 0 && <span className="rounded-full bg-kumo-fill px-2 py-0.5 text-xs text-kumo-subtle">{count}</span>}
		</NavLink>
		{custom && <>
			<button type="button" onClick={onRename} className="rounded-md p-2 text-kumo-subtle hover:bg-kumo-tint" aria-label={`Rename ${name}`}><PencilSimpleIcon size={16} /></button>
			<button type="button" onClick={onDelete} className="rounded-md p-2 text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-destructive" aria-label={`Delete ${name}`}><TrashIcon size={16} /></button>
		</>}
	</div>;
}
