// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { CheckIcon, CopyIcon, PaperclipIcon, StarIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { formatListDate } from "shared/dates";
import { extractVerificationCode } from "~/lib/verification-code";
import { clampMobileSwipe, getMobileSwipeAction } from "~/lib/mobile-gestures";
import { getSnippetText } from "~/lib/utils";
import type { Email, EmailTag } from "~/types";

export default function MobileEmailRow({
	email,
	onOpen,
	onArchive,
	onToggleRead,
	onToggleStar,
	onLongPress,
	swipeable = true,
	selected = false,
}: {
	email: Email;
	onOpen: () => void;
	onArchive?: () => void;
	onToggleRead?: () => void;
	onToggleStar?: () => void;
	onLongPress?: () => void;
	swipeable?: boolean;
	selected?: boolean;
}) {
	const [offset, setOffset] = useState(0);
	const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
	const start = useRef<{ x: number; y: number } | null>(null);
	const horizontal = useRef(false);
	const suppressClick = useRef(false);
	const longPress = useRef<number | undefined>(undefined);
	const code = extractVerificationCode(email.subject, email.snippet);
	const unread = email.thread_unread_count !== undefined
		? email.thread_unread_count > 0
		: !email.read;
	const participants = (email.participants || email.sender)
		.split(",")
		.map((value) => value.trim().split("@")[0])
		.filter(Boolean)
		.slice(0, 3)
		.join(", ");
	const snippet = getSnippetText(email.snippet, 120);

	const clearLongPress = () => {
		if (longPress.current !== undefined) window.clearTimeout(longPress.current);
		longPress.current = undefined;
	};

	const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!swipeable || (event.pointerType === "mouse" && event.button !== 0)) return;
		start.current = { x: event.clientX, y: event.clientY };
		horizontal.current = false;
		suppressClick.current = false;
		longPress.current = window.setTimeout(() => {
			suppressClick.current = true;
			onLongPress?.();
		}, 420);
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!start.current) return;
		const dx = event.clientX - start.current.x;
		const dy = event.clientY - start.current.y;
		if (!horizontal.current && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
			clearLongPress();
			return;
		}
		if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
			horizontal.current = true;
			clearLongPress();
			suppressClick.current = true;
			setOffset(clampMobileSwipe(dx));
		}
	};

	const onPointerEnd = () => {
		clearLongPress();
		if (start.current && horizontal.current) {
			const action = getMobileSwipeAction(offset);
			if (action === "archive") onArchive?.();
			if (action === "toggle-read") onToggleRead?.();
			suppressClick.current = true;
		}
		start.current = null;
		horizontal.current = false;
		setOffset(0);
	};

	const onPointerCancel = () => {
		clearLongPress();
		start.current = null;
		horizontal.current = false;
		setOffset(0);
	};

	const copyCode = async (event: React.MouseEvent) => {
		event.stopPropagation();
		if (!navigator.clipboard?.writeText || !code) {
			setCopyState("failed");
			return;
		}
		try {
			await navigator.clipboard.writeText(code);
			setCopyState("copied");
		} catch {
			setCopyState("failed");
		}
	};

	return (
		<div className="relative overflow-hidden border-b border-kumo-line">
			<div className={`absolute inset-y-0 flex w-24 items-center justify-center text-xs font-semibold ${offset < 0 ? "right-0 bg-kumo-warning/15 text-kumo-warning" : "left-0 bg-kumo-brand/15 text-kumo-brand"}`}>
				{offset < 0 ? "Archive" : unread ? "Mark read" : "Mark unread"}
			</div>
			<div
				role="button"
				tabIndex={0}
				aria-label={`${email.subject} from ${participants}`}
				onClick={() => {
					if (suppressClick.current) {
						suppressClick.current = false;
						return;
					}
					onOpen();
				}}
				onKeyDown={(event) => {
					if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
						event.preventDefault();
						onOpen();
					}
				}}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerEnd}
				onPointerCancel={onPointerCancel}
				onContextMenu={(event) => {
					event.preventDefault();
					onLongPress?.();
				}}
				style={{ transform: `translateX(${offset}px)`, touchAction: swipeable ? "pan-y" : "auto" }}
				className={`mobile-motion relative flex gap-3 bg-kumo-base px-4 py-3 text-left ${selected ? "bg-kumo-tint" : ""}`}
			>
				<div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${unread ? "bg-kumo-brand/15 text-kumo-brand" : "bg-kumo-fill text-kumo-subtle"}`}>
					{email.sender.charAt(0).toUpperCase()}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-1.5">
						<span className={`min-w-0 flex-1 truncate text-sm ${unread ? "font-semibold text-kumo-default" : "text-kumo-strong"}`}>{participants}</span>
						{(email.thread_count ?? 1) > 1 && <span className="rounded-full bg-kumo-fill px-1.5 text-[11px] text-kumo-subtle">{email.thread_count}</span>}
						{(email.attachments?.length || email.has_attachment) && <PaperclipIcon size={14} className="shrink-0 text-kumo-subtle" />}
						{onToggleStar && <button type="button" onClick={(event) => { event.stopPropagation(); onToggleStar(); }} className="shrink-0 rounded p-1 text-kumo-subtle" aria-label={email.starred ? "Unstar" : "Star"}><StarIcon size={16} weight={email.starred ? "fill" : "regular"} className={email.starred ? "text-kumo-warning" : ""} /></button>}
						<span className="shrink-0 text-[11px] text-kumo-subtle">{formatListDate(email.date)}</span>
					</div>
					<div className={`mt-1 truncate text-sm ${unread ? "font-medium text-kumo-default" : "text-kumo-strong"}`}>{email.subject || "(no subject)"}</div>
					{snippet && <div className="mt-0.5 line-clamp-2 text-xs text-kumo-subtle">{snippet}</div>}
					<div className="mt-1 flex flex-wrap items-center gap-1.5">
						{email.has_draft && <span className="rounded bg-kumo-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-kumo-warning">Draft</span>}
						{email.needs_reply && <span className="rounded bg-kumo-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-kumo-brand">Needs reply</span>}
						{email.tags?.filter((tag: EmailTag) => !tag.tag.startsWith("disposition:")) .slice(0, 3).map((tag: EmailTag) => <span key={tag.tag} className="rounded bg-kumo-fill px-1.5 py-0.5 text-[10px] text-kumo-subtle">{tag.tag}</span>)}
						{code && <button type="button" onClick={copyCode} className="inline-flex items-center gap-1 rounded-full bg-kumo-brand/10 px-2 py-0.5 text-[10px] font-semibold text-kumo-brand" aria-label={`Copy verification code ${code}`}><span>{code}</span>{copyState === "copied" ? <><CheckIcon size={12} /><span>Copied</span></> : copyState === "failed" ? <WarningCircleIcon size={12} /> : <CopyIcon size={12} />}</button>}
					</div>
					{copyState === "failed" && <span role="status" className="text-[10px] text-kumo-destructive">Copy unavailable</span>}
				</div>
			</div>
		</div>
	);
}
