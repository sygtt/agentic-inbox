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
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open, onClose]);

	if (!open) return null;
	const finishDrag = () => {
		if (offset > 80) onClose();
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
					onPointerCancel={finishDrag}
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
