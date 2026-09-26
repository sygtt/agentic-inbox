import type { EmailTag } from "~/types";
import {
	getThreadTriageErrorPresentation,
	getTriageErrorPresentation,
} from "~/lib/triage-presentation";

export default function TriageErrorBadge({
	tags,
	threadHasTriageError = false,
	className = "",
}: {
	tags: readonly EmailTag[] | undefined;
	threadHasTriageError?: boolean;
	className?: string;
}) {
	const presentation = threadHasTriageError
		? getThreadTriageErrorPresentation()
		: getTriageErrorPresentation(tags);
	if (!presentation) return null;

	return (
		<span
			role="img"
			aria-label={presentation.accessibleName}
			title={presentation.description}
			className={`inline-flex max-w-full items-center rounded border border-kumo-destructive/20 bg-kumo-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-kumo-destructive ${className}`}
		>
			{presentation.label}
		</span>
	);
}
