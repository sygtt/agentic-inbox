// SPDX-License-Identifier: Apache-2.0
import { DEFAULT_THEME, isThemeId, type Appearance, type ThemeId } from "../../shared/appearance.ts";
export const APPEARANCE_KEY = "app-settings/appearance.json";
type Bucket = Pick<R2Bucket, "get" | "put">;
export async function readAppearance(bucket: Bucket): Promise<Appearance> {
 try {
  const object = await bucket.get(APPEARANCE_KEY);
  if (!object) return { themeId: DEFAULT_THEME, error: null };
  let value: unknown;
  try { value = await object.json(); } catch { return failed("corrupt"); }
  if (!value || typeof value !== "object" || !isThemeId((value as { themeId?: unknown }).themeId)) return failed("corrupt");
  return { themeId: (value as { themeId: ThemeId }).themeId, error: null };
 } catch { return failed("read-failed"); }
}
function failed(error: "corrupt" | "read-failed"): Appearance {
 console.error(`Appearance settings: ${error}`);
 return { themeId: DEFAULT_THEME, error };
}
export async function writeAppearance(bucket: Bucket, themeId: ThemeId) {
 await bucket.put(APPEARANCE_KEY, JSON.stringify({ themeId }), { httpMetadata: { contentType: "application/json" } });
}
