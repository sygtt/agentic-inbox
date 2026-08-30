// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Input, Loader } from "@cloudflare/kumo";
import { XIcon } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { DISPOSITION_VALUES, TagSchema } from "../../../workers/lib/email-tags";
import {
	useEmailTags,
	useRemoveEmailTag,
	useSetEmailDisposition,
	useUpsertEmailTag,
} from "~/queries/email-tags";
import MobileBottomSheet from "./MobileBottomSheet";

export default function MobileTagSheet({
	open,
	mailboxId,
	emailId,
	onClose,
}: {
	open: boolean;
	mailboxId?: string;
	emailId: string;
	onClose: () => void;
}) {
	const { data: tags = [], isLoading, isError } = useEmailTags(mailboxId, emailId, { enabled: open });
	const addTag = useUpsertEmailTag();
	const removeTag = useRemoveEmailTag();
	const setDisposition = useSetEmailDisposition();
	const [newTag, setNewTag] = useState("");
	const [error, setError] = useState<string | null>(null);
	const disposition = tags.find((tag) => tag.tag.startsWith("disposition:"))?.tag.slice("disposition:".length);

	const run = async (operation: () => Promise<unknown>) => {
		setError(null);
		try {
			await operation();
			return true;
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not update tags");
			return false;
		}
	};

	const handleAdd = async (event: FormEvent) => {
		event.preventDefault();
		const parsed = TagSchema.safeParse(newTag);
		if (!parsed.success) {
			setError("Use a lowercase namespace:value tag, for example project:inbox.");
			return;
		}
		if (await run(() => addTag.mutateAsync({ mailboxId: mailboxId!, emailId, tag: parsed.data }))) setNewTag("");
	};

	return (
		<MobileBottomSheet open={open} title="Tags" onClose={onClose}>
			{isLoading ? (
				<div className="flex justify-center py-6"><Loader size="sm" /></div>
			) : isError ? (
				<p className="rounded-lg bg-kumo-destructive/10 p-3 text-sm text-kumo-destructive">Could not load tags.</p>
			) : (
				<div className="space-y-5">
					<div>
						<div className="mb-2 text-xs font-semibold uppercase tracking-wide text-kumo-subtle">Current tags</div>
						{tags.length === 0 ? <p className="text-sm text-kumo-subtle">No tags assigned.</p> : <div className="flex flex-wrap gap-2">
							{tags.map((tag) => <span key={tag.tag} className="inline-flex items-center gap-1 rounded-full bg-kumo-fill px-2.5 py-1 text-xs text-kumo-default">
								{tag.tag}
								<span className="text-[10px] text-kumo-subtle">({tag.provenance})</span>
								{!tag.tag.startsWith("disposition:") && <button type="button" onClick={() => run(() => removeTag.mutateAsync({ mailboxId: mailboxId!, emailId, tag: tag.tag }))} className="rounded-full text-kumo-subtle hover:text-kumo-default" aria-label={`Remove ${tag.tag}`}><XIcon size={13} /></button>}
							</span>)}
						</div>}
					</div>
					<div>
						<div className="mb-2 text-xs font-semibold uppercase tracking-wide text-kumo-subtle">Disposition</div>
						<div className="grid grid-cols-2 gap-2">
							{DISPOSITION_VALUES.map((value) => <button key={value} type="button" onClick={() => run(() => setDisposition.mutateAsync({ mailboxId: mailboxId!, emailId, value }))} className={`rounded-lg border px-2 py-2 text-xs ${disposition === value ? "border-kumo-brand bg-kumo-brand/10 font-semibold text-kumo-brand" : "border-kumo-line text-kumo-subtle hover:bg-kumo-tint"}`}>{value}</button>)}
						</div>
						<p className="mt-2 text-[11px] text-kumo-subtle">Selecting a disposition replaces the previous disposition.</p>
					</div>
					<form onSubmit={handleAdd} className="flex items-end gap-2 border-t border-kumo-line pt-4">
						<div className="min-w-0 flex-1"><Input label="Add manual tag" placeholder="project:inbox" value={newTag} onChange={(event) => setNewTag(event.target.value)} /></div>
						<Button type="submit" variant="secondary" disabled={!newTag.trim() || addTag.isPending}>Add</Button>
					</form>
					{error && <p role="alert" className="text-sm text-kumo-destructive">{error}</p>}
				</div>
			)}
		</MobileBottomSheet>
	);
}
