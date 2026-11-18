// SPDX-License-Identifier: Apache-2.0
import { Button } from "@cloudflare/kumo";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useAppearance } from "~/appearance/context";
import { isThemeId, themes, type Appearance, type ThemeId } from "../../shared/appearance";

async function requestAppearance(themeId?: ThemeId): Promise<Appearance> {
 const signal = AbortSignal.timeout(30_000);
 const response = await fetch("/api/v1/appearance", themeId ? {
  signal,
  method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ themeId }),
 } : { cache: "no-store", signal });
 const raw: unknown = await response.json();
 if (!raw || typeof raw !== "object") throw new Error("Invalid response");
 const value = raw as Record<string, unknown>;
 if (!isThemeId(value.themeId) || (value.error !== null && value.error !== "corrupt" && value.error !== "read-failed")) throw new Error("Invalid response");
 if (!response.ok && !value.error) throw new Error("Request failed");
 if (themeId && (!response.ok || value.themeId !== themeId)) throw new Error("Save failed");
 return { themeId: value.themeId, error: value.error as Appearance["error"] };
}
export default function AppearanceRoute() {
 const { saved, setSaved, preview, setPreview } = useAppearance();
 const selected = preview ?? saved.themeId;
 const [pending, setPending] = useState(false);
 const [message, setMessage] = useState("");
 const mounted = useRef(true);
 useEffect(() => {
  mounted.current = true;
  return () => { mounted.current = false; setPreview(null); };
 }, [setPreview]);
 async function save() {
  if (saved.error || pending) return;
  setPending(true); setMessage("");
  try {
   const value = await requestAppearance(selected);
   // A successful server write remains the saved value even if the user left
   // while it was in flight. Never reapply the abandoned preview.
   setSaved(value);
   if (mounted.current) { setPreview(null); setMessage("保存しました。"); }
  } catch { if (mounted.current) setMessage("保存できませんでした。未保存です。再試行または取消ができます。"); }
  finally { if (mounted.current) setPending(false); }
 }
 async function retry() {
  setPending(true); setMessage("");
  try { const value = await requestAppearance(); if (mounted.current) { setSaved(value); setPreview(null); } }
  catch { if (mounted.current) setMessage("設定を取得できませんでした。再試行してください。"); }
  finally { if (mounted.current) setPending(false); }
 }
 return <main className="mx-auto max-w-3xl p-4 md:p-8">
  <Link to="/" className="text-kumo-link underline">ホームへ</Link>
  <h1 className="my-4 text-2xl font-semibold">外観設定</h1>
  <p>アプリ全体・すべての端末に共通の設定です。選択はプレビューで、保存するまで確定しません。</p>
  <p className="my-3">{saved.error ? "代替表示: " : "保存済み: "}<strong>{themes[saved.themeId].name}</strong>{preview && preview !== saved.themeId ? "（プレビュー・未保存）" : ""}</p>
  {saved.error && <div role="alert" className="appearance-error my-4 rounded-lg border p-4">
   {saved.error === "corrupt" ? "保存された外観設定が破損しています。" : "外観設定を読み込めませんでした。"}
   既定の配色はAmethyst Lightです。誤って上書きしないよう保存を停止しています。
   <Button onClick={retry} disabled={pending}>再取得</Button>
  </div>}
  <fieldset disabled={pending} className="my-6">
   <legend className="mb-3 font-semibold">テーマを選択</legend>
   <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {(Object.keys(themes) as ThemeId[]).map(id => <label key={id} className="theme-choice rounded-xl border p-4" style={{ background: themes[id].colors.surface, color: themes[id].colors.onSurface, borderColor: selected === id ? themes[id].colors.primary : themes[id].colors.outline }}>
     <span className="flex items-center gap-3"><input type="radio" name="theme" value={id} checked={selected === id} onChange={() => { setPreview(id); setMessage(""); }} />{themes[id].name}{selected === id ? " ✓" : ""}</span>
     <span aria-hidden="true" className="mt-4 flex gap-2">
      <span className="h-7 w-14 rounded" style={{ background: themes[id].colors.primary }} />
      <span className="h-7 w-14 rounded" style={{ background: themes[id].colors.primaryContainer }} />
      <span className="h-7 w-14 rounded" style={{ background: themes[id].colors.surfaceElevated }} />
     </span>
    </label>)}
   </div>
  </fieldset>
  <div className="flex gap-3">
   <Button variant="primary" onClick={save} disabled={pending || !!saved.error || selected === saved.themeId}>保存</Button>
   <Button onClick={() => { setPreview(null); setMessage("変更を取り消しました。"); }} disabled={pending || !preview}>取消</Button>
  </div>
  <p role="status" className="my-4">{message || (pending ? "処理中…" : "")}</p>
 </main>;
}
