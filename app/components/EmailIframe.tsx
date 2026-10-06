// SPDX-License-Identifier: Apache-2.0
// Modified in the sygtt/agentic-inbox fork; see Git history.
// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import DOMPurify from "dompurify";
import { useCallback, useEffect, useRef, useState } from "react";
import { prepareEmailBody } from "~/lib/email-body";
import { EDITABLE_ESCAPE_TARGET_SELECTOR, isEmailIframeEscapeMessage } from "~/lib/email-panel-navigation";

interface EmailIframeProps {
	body: string;
	/** When true, iframe auto-sizes to content height instead of filling parent */
	autoSize?: boolean;
}

/**
 * Renders email HTML inside a sandboxed iframe.
 *
 * Security model:
 * - DOMPurify sanitises the HTML before injection.
 * - The iframe sandbox does NOT include `allow-same-origin`, so even if
 *   DOMPurify has a bypass the attacker's code runs in an opaque origin
 *   with no access to the parent page's cookies, DOM, or API.
 * - Because the iframe is cross-origin we cannot read `contentDocument`
 *   for auto-sizing. Instead, the injected HTML includes a tiny inline
 *   script that posts its body height to the parent via `postMessage`.
 *   The `allow-scripts` flag is required for this, but scripts inside
 *   the opaque-origin sandbox cannot access anything useful.
 * - The same bridge forwards Escape from inside the iframe: key events in a
 *   nested browsing context never reach the parent window, so the injected
 *   script posts the key and the parent replays it on its own DOM. The
 *   sandbox flags are unchanged and the payload carries no data.
 * - A strict CSP meta tag blocks external resource loads inside the
 *   iframe as a defense-in-depth layer.
 */
export default function EmailIframe({ body, autoSize }: EmailIframeProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [height, setHeight] = useState(autoSize ? 100 : 0);

	// Listen for height and Escape reports from the sandboxed iframe
	const handleMessage = useCallback(
		(event: MessageEvent) => {
			// Only accept messages from our own iframe
			if (event.source !== iframeRef.current?.contentWindow) return;
			if (isEmailIframeEscapeMessage(event.data)) {
				// Focus inside the sandboxed body keeps key events in that
				// browsing context, so replay the key on the parent DOM and
				// let the existing listeners decide who owns Escape.
				const replayed = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
				if (event.data.defaultPrevented === true) replayed.preventDefault();
				document.body.dispatchEvent(replayed);
				return;
			}
			if (!autoSize) return;
			if (
				event.data &&
				typeof event.data === "object" &&
				event.data.__emailIframeHeight &&
				typeof event.data.height === "number" &&
				event.data.height > 0
			) {
				setHeight(event.data.height);
			}
		},
		[autoSize],
	);

	useEffect(() => {
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [handleMessage]);

	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe || !body) return;

		const sanitizedBody = DOMPurify.sanitize(prepareEmailBody(body), {
			USE_PROFILES: { html: true },
			FORBID_TAGS: ["style"],
			ADD_ATTR: ["target"],
			FORCE_BODY: true,
		});
		const parsedBody = new DOMParser().parseFromString(sanitizedBody, "text/html");
		for (const link of parsedBody.body.querySelectorAll("a")) {
			link.target = "_blank";
			link.rel = "noopener noreferrer";
		}
		const cleanBody = parsedBody.body.innerHTML;

		const padding = autoSize ? "0" : "24px";

		// Bridge script: reports body height (autoSize only) and forwards
		// Escape, which otherwise dies inside the nested browsing context.
		// Runs inside the opaque-origin sandbox so it has zero access to
		// the parent page — it can only postMessage.
		const heightBridge = autoSize
			? `function reportHeight() {
					var h = document.body.scrollHeight;
					if (h > 0) parent.postMessage({ __emailIframeHeight: true, height: h }, "*");
				}
				reportHeight();
				setTimeout(reportHeight, 50);
				setTimeout(reportHeight, 150);
				setTimeout(reportHeight, 400);`
			: "";
		const bridgeScript = `<script>
			${heightBridge}
			document.addEventListener("keydown", function (event) {
				if (event.key !== "Escape") return;
				var target = event.target;
				// Leave Escape to a field the reader is editing inside the body.
				if (target && target.closest && target.closest(${JSON.stringify(EDITABLE_ESCAPE_TARGET_SELECTOR)})) return;
				parent.postMessage({ __emailIframeEscape: true, defaultPrevented: event.defaultPrevented }, "*");
			});
		<\/script>`;

		// Use srcdoc so the iframe is truly sandboxed (no same-origin access).
		// We can't use doc.write() because that requires allow-same-origin.
		iframe.srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: cid: https:; script-src 'unsafe-inline';">
<style>
* { box-sizing: border-box; }
html {
	background: #ffffff;
	color-scheme: light;
}
body {
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
	font-size: 14px;
	line-height: 1.6;
	color: #1a1a1a;
	background: #ffffff;
	padding: ${padding};
	margin: 0;
	word-wrap: break-word;
	overflow-wrap: break-word;
	${autoSize ? "overflow: hidden;" : ""}
}
[style*="position: fixed"], [style*="position:fixed"], [style*="position: absolute"], [style*="position:absolute"] {
	position: relative !important;
}
a { color: #2563eb; }
img { max-width: 100%; height: auto; }
blockquote {
	border-left: 3px solid #d1d5db;
	padding-left: 1em;
	margin-left: 0;
	color: #6b7280;
}
pre {
	background: #f3f4f6;
	padding: 12px;
	border-radius: 6px;
	overflow-x: auto;
	font-size: 13px;
}
table { border-collapse: collapse; max-width: 100%; }
td, th { padding: 4px 8px; }
p { margin: 4px 0; }
h1, h2, h3 { margin: 8px 0 4px; }
ul, ol { padding-left: 20px; margin: 4px 0; }
</style>
</head>
<body>${cleanBody}${bridgeScript}</body>
</html>`;
	}, [body, autoSize]);

	return (
		<iframe
			ref={iframeRef}
			className="block w-full border-0"
			style={autoSize ? { height: `${height}px` } : { height: "100%" }}
			sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
			title="Email content"
		/>
	);
}
