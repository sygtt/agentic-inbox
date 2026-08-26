// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button } from "@cloudflare/kumo";
import { CheckIcon, CopyIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { extractVerificationCode } from "~/lib/verification-code";

export default function VerificationCodeAction({
	subject,
	body,
}: {
	subject: string;
	body?: string | null;
}) {
	const code = extractVerificationCode(subject, body);
	const [feedback, setFeedback] = useState<"idle" | "copied" | "failed">("idle");

	if (!code) return null;

	const copyCode = async () => {
		if (!navigator.clipboard?.writeText) {
			setFeedback("failed");
			return;
		}
		try {
			await navigator.clipboard.writeText(code);
			setFeedback("copied");
		} catch {
			setFeedback("failed");
		}
	};

	return (
		<div className="mx-4 my-4 rounded-lg border border-kumo-brand/30 bg-kumo-brand/5 p-3 md:mx-6">
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<div className="text-xs font-semibold uppercase tracking-wide text-kumo-subtle">
						Verification code
					</div>
					<code className="text-2xl font-bold tracking-[0.2em] text-kumo-default">
						{code}
					</code>
				</div>
				<Button
					variant="primary"
					size="sm"
					icon={feedback === "copied" ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
					onClick={copyCode}
				>
					{feedback === "copied" ? "Copied" : "Copy"}
				</Button>
			</div>
			<div role="status" aria-live="polite" className="mt-1.5 min-h-4 text-xs text-kumo-subtle">
				{feedback === "failed" && (
					<span className="inline-flex items-center gap-1 text-kumo-destructive">
						<WarningCircleIcon size={14} />
						Copy unavailable. Select the code manually.
					</span>
				)}
			</div>
		</div>
	);
}
