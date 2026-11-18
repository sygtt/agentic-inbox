// SPDX-License-Identifier: Apache-2.0
import type { Hono } from "hono";
import type { MailboxContext } from "./mailbox";
import { isThemeId } from "../../shared/appearance.ts";
import { readAppearance, writeAppearance } from "./appearance.ts";

// Inherits the existing Access boundary in workers/app.ts. Never mailbox-scoped.
export function registerAppearanceRoutes(app: Hono<MailboxContext>) {
 app.get("/api/v1/appearance", async (c) => {
  c.header("Cache-Control", "no-store");
  const appearance = await readAppearance(c.env.BUCKET);
  return c.json(appearance, appearance.error ? 503 : 200);
 });
 app.put("/api/v1/appearance", async (c) => {
  c.header("Cache-Control", "no-store");
  // Require an explicit same-origin Origin on this new mutation endpoint.
  if (c.req.header("Origin") !== new URL(c.req.url).origin || c.req.header("Sec-Fetch-Site") === "cross-site") {
   return c.json({ error: "Same-origin request required" }, 403);
  }
  if (c.req.header("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") return c.json({ error: "JSON required" }, 415);
  // Bound the body even when Content-Length is absent or forged.
  const reader = c.req.raw.body?.getReader();
  if (!reader) return c.json({ error: "Invalid appearance" }, 400);
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) {
   const chunk = await reader.read();
   if (chunk.done) break;
   size += chunk.value.byteLength;
   if (size > 1024) { await reader.cancel(); return c.json({ error: "Body too large" }, 413); }
   chunks.push(chunk.value);
  }
  let value: unknown;
  try {
   const bytes = new Uint8Array(size); let offset = 0;
   for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
   value = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return c.json({ error: "Invalid appearance" }, 400); }
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 1 || !isThemeId((value as {themeId?: unknown}).themeId)) return c.json({ error: "Invalid appearance" }, 400);
  const themeId = (value as { themeId: import("../../shared/appearance").ThemeId }).themeId;
  // A stale client must not overwrite an unreadable/corrupt object.
  if ((await readAppearance(c.env.BUCKET)).error) return c.json({ error: "Read settings successfully before saving" }, 503);
  try {
   await writeAppearance(c.env.BUCKET, themeId);
   return c.json({ themeId, error: null });
  } catch {
   console.error("Appearance settings: save-failed");
   return c.json({ error: "Could not save appearance" }, 503);
  }
 });
}
