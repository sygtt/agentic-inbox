// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Badge,
	Banner,
	Button,
	Dialog,
	Input,
	Loader,
	Select,
	Switch,
	useKumoToastManager,
} from "@cloudflare/kumo";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	PencilSimpleIcon,
	PlusIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { useFolders } from "~/queries/folders";
import {
	useCreateMailRule,
	useDeleteMailRule,
	useMailRules,
	useReorderMailRules,
	useUpdateMailRule,
} from "~/queries/mail-rules";
import type { Folder, MailRule, MailRuleInput } from "~/types";
import { MailRuleInputSchema } from "../../workers/lib/mail-rules.ts";

interface RuleFormState {
	envelopeRecipient: string;
	sender: string;
	senderDomain: string;
	subjectContains: string;
	folderId: string;
	tags: string;
	enabled: boolean;
}

type ConditionField =
	| "envelopeRecipient"
	| "sender"
	| "senderDomain"
	| "subjectContains";

const EMPTY_FORM: RuleFormState = {
	envelopeRecipient: "",
	sender: "",
	senderDomain: "",
	subjectContains: "",
	folderId: "none",
	tags: "",
	enabled: true,
};

const CONDITION_LABELS: Array<[ConditionField, string]> = [
	["envelopeRecipient", "Envelope recipient"],
	["sender", "Sender address"],
	["senderDomain", "Sender domain"],
	["subjectContains", "Subject contains"],
];

function formFromRule(rule: MailRule): RuleFormState {
	return {
		envelopeRecipient: rule.conditions.envelopeRecipient || "",
		sender: rule.conditions.sender || "",
		senderDomain: rule.conditions.senderDomain || "",
		subjectContains: rule.conditions.subjectContains || "",
		folderId: rule.action.folderId || "none",
		tags: rule.action.tags.join(", "),
		enabled: rule.enabled,
	};
}

function parseForm(form: RuleFormState): MailRuleInput {
	const conditions = Object.fromEntries(
		CONDITION_LABELS
			.map(([key]) => [key, form[key].trim()])
			.filter(([, value]) => value),
	);
	const action = {
		...(form.folderId !== "none" && { folderId: form.folderId }),
		tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
	};
	const result = MailRuleInputSchema.safeParse({
		enabled: form.enabled,
		conditions,
		action,
	});
	if (!result.success) throw new Error(result.error.issues[0]?.message || "Invalid mail rule");
	return result.data as MailRuleInput;
}

function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

function conditionSummary(rule: MailRule): string[] {
	return [
		rule.conditions.envelopeRecipient && `envelope recipient = ${rule.conditions.envelopeRecipient}`,
		rule.conditions.sender && `sender = ${rule.conditions.sender}`,
		rule.conditions.senderDomain && `sender domain = ${rule.conditions.senderDomain}`,
		rule.conditions.subjectContains && `subject contains “${rule.conditions.subjectContains}”`,
	].filter((value): value is string => Boolean(value));
}

function folderLabel(folderId: string | undefined, folders: Folder[]): string | null {
	if (!folderId) return null;
	return folders.find((folder) => folder.id === folderId)?.name || folderId;
}

export default function MailRulesSettings({ mailboxId }: { mailboxId: string }) {
	const toastManager = useKumoToastManager();
	const rulesQuery = useMailRules(mailboxId);
	const { data: folders = [] } = useFolders(mailboxId);
	const createMutation = useCreateMailRule();
	const updateMutation = useUpdateMailRule();
	const deleteMutation = useDeleteMailRule();
	const reorderMutation = useReorderMailRules();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingRule, setEditingRule] = useState<MailRule | null>(null);
	const [form, setForm] = useState(EMPTY_FORM);
	const [formError, setFormError] = useState<string | null>(null);
	const [mutationError, setMutationError] = useState<string | null>(null);

	const isBusy = createMutation.isPending || updateMutation.isPending ||
		deleteMutation.isPending || reorderMutation.isPending;

	const openCreate = () => {
		setEditingRule(null);
		setForm(EMPTY_FORM);
		setFormError(null);
		setMutationError(null);
		setDialogOpen(true);
	};

	const openEdit = (rule: MailRule) => {
		setEditingRule(rule);
		setForm(formFromRule(rule));
		setFormError(null);
		setMutationError(null);
		setDialogOpen(true);
	};

	const updateForm = (field: keyof RuleFormState, value: string | boolean) => {
		setForm((current) => ({ ...current, [field]: value }));
	};

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		setFormError(null);
		setMutationError(null);
		let rule: MailRuleInput;
		try {
			rule = parseForm(form);
		} catch (error) {
			setFormError(errorMessage(error, "Invalid mail rule"));
			return;
		}

		try {
			if (editingRule) {
				await updateMutation.mutateAsync({ mailboxId, id: editingRule.id, rule });
			} else {
				await createMutation.mutateAsync({ mailboxId, rule });
			}
			setDialogOpen(false);
			toastManager.add({ title: editingRule ? "Rule updated" : "Rule created" });
		} catch (error) {
			setFormError(errorMessage(error, "Failed to save mail rule"));
		}
	};

	const handleToggle = async (rule: MailRule, enabled: boolean) => {
		setMutationError(null);
		try {
			const { id: _id, ...ruleInput } = rule;
			await updateMutation.mutateAsync({
				mailboxId,
				id: rule.id,
				rule: { ...ruleInput, enabled },
			});
		} catch (error) {
			setMutationError(errorMessage(error, "Failed to update mail rule"));
		}
	};

	const handleDelete = async (rule: MailRule) => {
		if (!window.confirm("Delete this mail rule?")) return;
		setMutationError(null);
		try {
			await deleteMutation.mutateAsync({ mailboxId, id: rule.id });
			toastManager.add({ title: "Rule deleted" });
		} catch (error) {
			setMutationError(errorMessage(error, "Failed to delete mail rule"));
		}
	};

	const moveRule = async (index: number, direction: -1 | 1) => {
		const rules = rulesQuery.data || [];
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= rules.length) return;
		const ruleIds = rules.map((rule) => rule.id);
		[ruleIds[index], ruleIds[targetIndex]] = [ruleIds[targetIndex], ruleIds[index]];
		setMutationError(null);
		try {
			await reorderMutation.mutateAsync({ mailboxId, ruleIds });
		} catch (error) {
			setMutationError(errorMessage(error, "Failed to reorder mail rules"));
		}
	};

	return (
		<section className="rounded-lg border border-kumo-line bg-kumo-base p-5">
			<div className="flex flex-wrap items-start justify-between gap-3 mb-2">
				<div>
					<h2 className="text-sm font-medium text-kumo-default">Mail rules</h2>
					<p className="text-xs text-kumo-subtle mt-1">
						Rules run from top to bottom. The first matching enabled rule is applied.
					</p>
				</div>
				<Button variant="primary" size="sm" icon={<PlusIcon size={15} />} onClick={openCreate}>
					New rule
				</Button>
			</div>

			{mutationError && <Banner variant="error" text={mutationError} />}
			{rulesQuery.isLoading ? (
				<div className="flex justify-center py-8"><Loader /></div>
			) : rulesQuery.isError ? (
				<div className="space-y-3 py-4">
					<Banner variant="error" text={errorMessage(rulesQuery.error, "Failed to load mail rules")} />
					<Button variant="secondary" size="sm" onClick={() => rulesQuery.refetch()}>Try again</Button>
				</div>
			) : rulesQuery.data?.length ? (
				<div className="space-y-3 mt-4">
					{rulesQuery.data.map((rule, index) => {
						const destination = folderLabel(rule.action.folderId, folders);
						return (
							<div
								key={rule.id}
								className={`rounded-lg border border-kumo-line p-4 ${rule.enabled ? "" : "opacity-60"}`}
							>
								<div className="flex items-start gap-3">
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<span className="text-xs font-semibold text-kumo-subtle">{index + 1}</span>
											<Badge variant={rule.enabled ? "primary" : "secondary"}>
												{rule.enabled ? "Enabled" : "Disabled"}
											</Badge>
										</div>
										<div className="mt-2 break-words text-sm text-kumo-default">
											<div><span className="font-medium">IF</span> {conditionSummary(rule).join(" AND ")}</div>
											<div className="mt-1 pl-5">
												<span className="font-medium">THEN</span>{destination && ` folder = ${destination}`}
												{destination && rule.action.tags.length > 0 && ","}
												{rule.action.tags.length > 0 && ` tags = ${rule.action.tags.join(", ")}`}
											</div>
										</div>
								</div>
								<div className="flex shrink-0 items-center gap-1">
									<Switch
										checked={rule.enabled}
										onCheckedChange={(enabled) => void handleToggle(rule, enabled)}
										aria-label={`${rule.enabled ? "Disable" : "Enable"} rule ${index + 1}`}
										disabled={isBusy}
										size="sm"
									/>
								</div>
								</div>
								<div className="flex flex-wrap items-center gap-1 mt-3 pt-3 border-t border-kumo-line">
									<Button variant="ghost" size="sm" icon={<ArrowUpIcon size={15} />} disabled={index === 0 || isBusy} onClick={() => void moveRule(index, -1)} aria-label={`Move rule ${index + 1} up`}>Up</Button>
									<Button variant="ghost" size="sm" icon={<ArrowDownIcon size={15} />} disabled={index === rulesQuery.data!.length - 1 || isBusy} onClick={() => void moveRule(index, 1)} aria-label={`Move rule ${index + 1} down`}>Down</Button>
									<span className="flex-1" />
									<Button variant="ghost" size="sm" icon={<PencilSimpleIcon size={15} />} onClick={() => openEdit(rule)} disabled={isBusy}>Edit</Button>
									<Button variant="ghost" size="sm" icon={<TrashIcon size={15} />} onClick={() => void handleDelete(rule)} disabled={isBusy} aria-label={`Delete rule ${index + 1}`}>Delete</Button>
								</div>
							</div>
						);
					})}
				</div>
			) : (
				<div className="rounded-lg border border-dashed border-kumo-line py-8 px-4 mt-4 text-center">
					<p className="text-sm text-kumo-default">No mail rules yet.</p>
					<p className="text-xs text-kumo-subtle mt-1">Create one to organize matching inbound messages.</p>
				</div>
			)}

			<Dialog.Root
				open={dialogOpen}
				onOpenChange={(open) => {
					if (!open && isBusy) return;
					setDialogOpen(open);
				}}
			>
				<Dialog size="lg" className="p-6 max-h-[85vh] overflow-y-auto">
					<Dialog.Title className="text-base font-semibold mb-5">
						{editingRule ? "Edit mail rule" : "Create mail rule"}
					</Dialog.Title>
					<form onSubmit={handleSubmit} noValidate className="space-y-4">
						<p className="text-xs text-kumo-subtle">
							All conditions are combined with AND. Leave a condition blank to ignore it.
						</p>
						{formError && <Banner variant="error" text={formError} />}
						<div className="space-y-3">
							{CONDITION_LABELS.map(([field, label]) => (
								<Input
									key={field}
									label={label}
									type={field === "envelopeRecipient" || field === "sender" ? "email" : "text"}
									value={form[field] as string}
									onChange={(event) => updateForm(field, event.target.value)}
									placeholder={field === "senderDomain" ? "example.com" : undefined}
								/>
							))}
						</div>
						<Select
							label="Destination folder"
							value={form.folderId}
							onValueChange={(value) => updateForm("folderId", String(value || "none"))}
						>
							<Select.Option value="none">No folder change</Select.Option>
							{folders.map((folder) => <Select.Option key={folder.id} value={folder.id}>{folder.name}</Select.Option>)}
						</Select>
						<Input
							label="Tags"
							value={form.tags}
							onChange={(event) => updateForm("tags", event.target.value)}
							placeholder="source:newsletter, service:billing"
							description="Comma-separated lowercase namespace:value tags. A folder or at least one tag is required."
						/>
						<Switch
							label="Enabled"
							checked={form.enabled}
							onCheckedChange={(enabled) => updateForm("enabled", enabled)}
						/>
						<div className="flex justify-end gap-2 pt-2">
							<Dialog.Close render={(props) => <Button {...props} variant="secondary" disabled={isBusy}>Cancel</Button>} />
							<Button type="submit" variant="primary" loading={isBusy}>
								{editingRule ? "Save rule" : "Create rule"}
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>
		</section>
	);
}
