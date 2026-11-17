// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
// Load real TSX with only service/runtime boundaries replaced; no browser or email delivery.
function load(path: string, mocks: Record<string, any>) {
	const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
	const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
	const module = { exports: {} as any };
	new Function("require", "module", "exports", code)((id: string) => id in mocks ? mocks[id] : require(id), module, module.exports);
	return module.exports;
}
let mailbox: any;
const { useSendingActions } = load("app/hooks/useSendingActions.ts", {
	"~/queries/mailboxes": { useMailbox: (id: string) => ({ data: mailbox?.id === id ? mailbox : undefined }) },
});
const nullComponent = () => null;
const mocks = {
	"~/hooks/useSendingActions": { useSendingActions },
	"@phosphor-icons/react": new Proxy({}, { get: () => nullComponent }),
	"@cloudflare/kumo": {
		Button: ({ children, icon, loading, shape, variant, size, ...props }: any) => React.createElement("button", props, children),
		Tooltip: ({ children }: any) => children,
	},
	"react-router": { NavLink: ({ children, to }: any) => React.createElement("a", { href: to }, children) },
	"~/queries/folders": { useFolders: () => ({ data: [] }) },
	"shared/folders": { Folders: { INBOX: "inbox" } },
};
const Toolbar = load("app/components/email-panel/EmailPanelToolbar.tsx", mocks).default;
const Nav = load("app/components/mobile/MobileBottomNav.tsx", mocks).default;
const email = { id: "one", sender: "sender@example.com", recipient: "me@example.com", subject: "Example", date: "2026-01-01", read: false };
const toolbar = (draft = false) => renderToStaticMarkup(React.createElement(Toolbar, { mailboxId: "a", email, isDraftFolder: draft, moveToFolders: [], onArchive() {} }));

test("loading, failure without cached data and mailbox switching never flash send actions", () => {
	mailbox = undefined;
	assert.equal(useSendingActions("a"), false);
	mailbox = { id: "b", settings: { showSendingActions: true } };
	assert.equal(useSendingActions("a"), false);
	assert.equal(useSendingActions("b"), true);
});
test("unset, ON, OFF and back ON preserve legacy default per mailbox", () => {
	for (const [settings, expected] of [[undefined, true], [{}, true], [{ showSendingActions: false }, false], [{ showSendingActions: true }, true]] as const) {
		mailbox = { id: "a", settings };
		assert.equal(useSendingActions("a"), expected);
		for (const action of ["Reply", "Reply All", "Forward"]) assert.equal(toolbar().includes(`aria-label="${action}"`), expected);
		assert.equal(toolbar(true).includes(">Send</button>"), expected);
		assert.equal(toolbar(true).includes(">Edit</button>"), expected);
		assert.match(toolbar(), /aria-label="Archive"/);
		assert.match(toolbar(true), /aria-label="Delete permanently"/);
	}
});
test("mobile navigation removes Compose and its column while retaining folders and settings", () => {
	for (const shown of [false, true]) {
		mailbox = { id: "a", settings: { showSendingActions: shown } };
		const html = renderToStaticMarkup(React.createElement(Nav, { mailboxId: "a", visible: true }));
		assert.equal(html.includes(">Compose</span>"), shown);
		assert.match(html, new RegExp(shown ? "grid-cols-5" : "grid-cols-4"));
		assert.match(html, /\/emails\/inbox/);
		assert.match(html, /\/folders/);
		assert.match(html, /\/settings/);
	}
});
test("successful settings save updates only the saved mailbox cache, failure cannot mutate it", async () => {
	const cache = new Map([["a", { id: "a", settings: { fromName: "Alice", agentSystemPrompt: "Keep" } }], ["b", { id: "b", settings: {} }]]);
	let mutation: any;
	const queries = load("app/queries/mailboxes.ts", {
		"@tanstack/react-query": { useQueryClient: () => ({ setQueryData: (key: string[], data: any) => cache.set(key[1], data), invalidateQueries() {} }), useMutation: (options: any) => (mutation = options) },
		"./keys": { queryKeys: { mailboxes: { all: ["mailboxes"], detail: (id: string) => ["mailboxes", id] } } },
		"~/services/api": { updateMailbox: async () => { throw new Error("save failed"); } },
	});
	queries.useUpdateMailbox();
	await assert.rejects(mutation.mutationFn({ mailboxId: "a", settings: { showSendingActions: false } }), /save failed/);
	assert.equal(cache.get("a")!.settings.fromName, "Alice");
	assert.equal(mutation.onError, undefined);
	const before = cache.get("a");
	const saved = { id: "a", settings: { ...before!.settings, showSendingActions: false } };
	mutation.onSuccess(saved, { mailboxId: "a" });
	assert.deepEqual(cache.get("a"), saved);
	assert.deepEqual(cache.get("b"), { id: "b", settings: {} });
	assert.equal(cache.get("a")!.settings.fromName, "Alice");
	assert.equal(cache.get("a")!.settings.agentSystemPrompt, "Keep");
});

const threadMocks = {
	...mocks,
	"@cloudflare/kumo": { ...mocks["@cloudflare/kumo"], Badge: ({ children }: any) => React.createElement("span", null, children) },
	"~/queries/email-tags": { useEmailTags: () => ({ data: [] }) },
	"~/components/EmailAttachmentList": nullComponent,
	"~/components/EmailIframe": ({ body }: any) => React.createElement("div", null, body),
	"~/components/VerificationCodeAction": nullComponent,
	"~/components/triage/TriageErrorBadge": nullComponent,
	"~/lib/utils": { formatDetailDate: () => "Today", formatShortDate: () => "Today", rewriteInlineImages: (s: string) => s, stripHtml: (s: string) => s },
};
const Thread = load("app/components/email-panel/ThreadMessage.tsx", threadMocks).default;
test("thread draft hides send/edit but preserves body, expansion and discard", () => {
	for (const shown of [false, true]) {
		mailbox = { id: "a", settings: { showSendingActions: shown } };
		const html = renderToStaticMarkup(React.createElement(Thread, {
			mailboxId: "a", email: { ...email, body: "Draft body" }, isDraft: true, isExpanded: true,
			onSendDraft() {}, onEditDraft() {}, onDeleteDraft() {},
		}));
		assert.equal(html.includes(">Send</button>"), shown);
		assert.equal(html.includes(">Edit</button>"), shown);
		assert.match(html, /Draft body/);
		assert.match(html, /Discard/);
		assert.match(html, /Collapse message/);
	}
});
