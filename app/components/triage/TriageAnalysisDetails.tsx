import { useEffect, useRef, useState } from "react";
import type { EmailTag } from "~/types";
import { useEmailTags } from "~/queries/email-tags";
import { useEmailTriageAnalysis } from "~/queries/email-triage";
import { formatAnalyzedAt, getTriageFeatureRows } from "~/lib/triage-presentation";
import { shouldRefreshAnalysisAfterTriageRecovery } from "~/lib/triage-refresh";

export default function TriageAnalysisDetails({
	mailboxId,
	emailId,
}: {
	mailboxId?: string;
	emailId: string;
}) {
	const [open, setOpen] = useState(false);
	const analysisQuery = useEmailTriageAnalysis(mailboxId, emailId, {
		enabled: open,
		refreshWhilePending: open,
	});
	const tagsQuery = useEmailTags(mailboxId, emailId, {
		enabled: open,
		refreshWhileTriagePending: open,
	});
	const tags: EmailTag[] = tagsQuery.data ?? [];
	const hasTriageError = tags.some(({ tag, provenance }) => tag === "triage:error" && provenance === "system");
	const previouslyHadTriageError = useRef(false);
	const currentDisposition = tags.find(({ tag }) => tag.startsWith("disposition:"));

	useEffect(() => {
		if (hasTriageError) {
			previouslyHadTriageError.current = true;
			return;
		}

		if (!open) return;
		if (shouldRefreshAnalysisAfterTriageRecovery(
			previouslyHadTriageError.current,
			hasTriageError,
			tagsQuery.isSuccess,
		)) {
			previouslyHadTriageError.current = false;
			void analysisQuery.refetch();
		}
	}, [analysisQuery.refetch, hasTriageError, open, tagsQuery.isSuccess]);

	return (
		<details
			className="mt-3 rounded-lg border border-kumo-line bg-kumo-base"
			onToggle={(event) => setOpen(event.currentTarget.open)}
		>
			<summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-kumo-default focus-visible:outline-2 focus-visible:outline-kumo-brand">
				AI判定詳細
			</summary>
			<div className="border-t border-kumo-line px-3 py-3 text-xs">
				{analysisQuery.isPending ? (
					<p className="text-kumo-subtle">判定結果を読み込み中…</p>
				) : analysisQuery.isError ? (
					<div className="flex flex-wrap items-center gap-2 text-kumo-destructive">
						<p role="alert">判定結果を読み込めませんでした。</p>
						<button type="button" className="underline" onClick={() => void analysisQuery.refetch()}>
							再試行
						</button>
					</div>
				) : !analysisQuery.data ? (
					<p className="text-kumo-subtle">このメールにはJevの解析結果がありません。</p>
				) : (
					<>
						<dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
							<div>
								<dt className="text-kumo-subtle">Jevの予測</dt>
								<dd className="break-words font-medium text-kumo-default">{analysisQuery.data.predictedDisposition}</dd>
							</div>
							<div>
							<dt className="text-kumo-subtle">現在のタグ</dt>
								<dd className="break-words font-medium text-kumo-default">
									{tagsQuery.isPending
										? "読み込み中…"
										: tagsQuery.isError
											? <span role="alert" className="text-kumo-destructive">タグを読み込めませんでした</span>
										: currentDisposition
										? `${currentDisposition.tag} (${currentDisposition.provenance})`
										: "dispositionタグなし"}
								</dd>
								{tagsQuery.isError && (
									<dd>
										<button type="button" className="text-kumo-destructive underline" disabled={tagsQuery.isFetching} onClick={() => void tagsQuery.refetch()}>
											{tagsQuery.isFetching ? "タグを再読み込み中…" : "タグを再読み込み"}
									</button>
									</dd>
								)}
							</div>
							<div>
								<dt className="text-kumo-subtle">Model</dt>
								<dd className="break-words font-medium text-kumo-default">{analysisQuery.data.model}</dd>
							</div>
							<div>
								<dt className="text-kumo-subtle">Schema version</dt>
								<dd className="font-medium text-kumo-default">{analysisQuery.data.schemaVersion}</dd>
							</div>
							<div>
								<dt className="text-kumo-subtle">Policy version</dt>
								<dd className="font-medium text-kumo-default">{analysisQuery.data.policyVersion}</dd>
							</div>
							<div>
								<dt className="text-kumo-subtle">Analyzed at</dt>
								<dd className="font-medium text-kumo-default">
									<time dateTime={analysisQuery.data.analyzedAt}>{formatAnalyzedAt(analysisQuery.data.analyzedAt)}</time>
								</dd>
							</div>
						</dl>
						<dl className="mt-3 grid grid-cols-1 gap-2 border-t border-kumo-line pt-3 sm:grid-cols-2 lg:grid-cols-3">
							{getTriageFeatureRows(analysisQuery.data.features).map((row) => (
								<div key={row.key} className="min-w-0">
									<dt className="font-mono text-[10px] text-kumo-subtle">{row.key}<span className="sr-only"> — {row.label}</span></dt>
									<dd className="break-words text-kumo-default">{row.value}</dd>
								</div>
							))}
						</dl>
					</>
				)}
			</div>
		</details>
	);
}
