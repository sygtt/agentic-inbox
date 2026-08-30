// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useEffect, useRef, useState, type ReactNode } from "react";

export default function MobileBottomSheet({
	open,
	title,
	onClose,
	children,
}: {
	open: boolean;
	title: string;
	onClose: () => void;
	children: ReactNode;
}) {
	const [offset, setOffset] = useState(0);
	const startY = useRef<number | null>(null);
	const dialogRef = useRef<HTMLElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const onCloseRef = useRef(onClose);
	const wasOpenRef = useRef(false);
	useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

	useEffect(() => {
		if (!open) {
			if (wasOpenRef.current && previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
			wasOpenRef.current = false;
			previousFocusRef.current = null;
			return;
		}

		wasOpenRef.current = true;
		previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const getFocusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") || []).filter((element) => !element.hasAttribute("disabled"));
		const frame = requestAnimationFrame(() => getFocusable()[0]?.focus());
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onCloseRef.current();
				return;
			}
			if (event.key !== "Tab") return;
			const focusable = getFocusable();
			if (focusable.length === 0) {
				event.preventDefault();
				return;
			}
			const active = document.activeElement;
			if (!dialogRef.current?.contains(active) || (event.shiftKey && active === focusable[0])) {
				event.preventDefault();
				focusable[focusable.length - 1].focus();
			} else if (!event.shiftKey && active === focusable[focusable.length - 1]) {
				event.preventDefault();
				focusable[0].focus();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => {
			cancelAnimationFrame(frame);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	if (!open) return null;
	const finishDrag = () => {
		if (offset > 80) onClose();
		startY.current = null;
		setOffset(0);
	};
	const cancelDrag = () => {
		startY.current = null;
		setOffset(0);
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-end bg-black/40 md:hidden"
			role="presentation"
			onClick={onClose}
		>
			<section
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="mobile-sheet-title"
				onClick={(event) => event.stopPropagation()}
				style={{ transform: `translateY(${offset}px)` }}
				className="mobile-safe-bottom mobile-motion max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border-t border-kumo-line bg-kumo-base px-4 pb-4 pt-3 shadow-2xl"
			>
				<div
					className="mx-auto mb-3 h-5 w-12 touch-none rounded-full bg-kumo-fill"
					onPointerDown={(event) => {
						startY.current = event.clientY;
						event.currentTarget.setPointerCapture(event.pointerId);
					}}
					onPointerMove={(event) => {
						if (startY.current !== null) setOffset(Math.max(0, Math.min(180, event.clientY - startY.current)));
					}}
					onPointerUp={finishDrag}
					onPointerCancel={cancelDrag}
					aria-hidden="true"
				/>
				<div className="mb-3 flex items-center justify-between gap-3">
					<h2 id="mobile-sheet-title" className="text-base font-semibold text-kumo-default">
						{title}
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="rounded-md px-2 py-1 text-sm text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default"
					>
						Close
					</button>
				</div>
				{children}
			</section>
		</div>
	);
}
