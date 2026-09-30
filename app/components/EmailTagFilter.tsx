import { getEmailTagFilterOptions } from "~/lib/email-tag-filter";

export default function EmailTagFilter({
	availableTags,
	selectedTag,
	isLoading,
	isError,
	onSelect,
	onRetry,
}: {
	availableTags: readonly string[];
	selectedTag?: string;
	isLoading: boolean;
	isError: boolean;
	onSelect: (tag?: string) => void;
	onRetry: () => void;
}) {
	const options = getEmailTagFilterOptions(availableTags);

	return (
		<div className="flex flex-wrap items-center gap-2">
			<label className="flex items-center gap-2 text-xs text-kumo-subtle">
				<span>Tag</span>
				<select
					aria-label="Filter emails by tag"
					value={selectedTag ?? ""}
					onChange={(event) => onSelect(event.target.value || undefined)}
					className="max-w-[min(58vw,18rem)] rounded-lg border border-kumo-line bg-kumo-base px-2.5 py-1.5 text-xs text-kumo-default"
				>
					<option value="">All tags</option>
					{options.map(({ tag, label }) => (
						<option key={tag} value={tag}>{label}</option>
					))}
				</select>
			</label>
			{selectedTag && (
				<button
					type="button"
					onClick={() => onSelect(undefined)}
					className="text-xs text-kumo-brand underline underline-offset-2"
				>
					Clear tag filter
				</button>
			)}
			{isLoading && <span className="text-xs text-kumo-subtle" role="status">Loading tags…</span>}
			{isError && (
				<span className="inline-flex items-center gap-1 text-xs text-kumo-destructive">
					<span role="alert">Could not load available tags.</span>
					<button type="button" onClick={onRetry} className="underline">Retry</button>
				</span>
			)}
		</div>
	);
}
