// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { registerAppearanceRoutes } from "../workers/lib/appearance-api.ts";
import { APPEARANCE_KEY } from "../workers/lib/appearance.ts";
import { themes, DEFAULT_THEME } from "../shared/appearance.ts";

function fixture(initial: unknown = undefined) {
 let stored = initial; let writes = 0; let readFailure = false; let writeFailure = false;
 const bucket = {
  get: async (key: string) => {
   assert.equal(key, APPEARANCE_KEY);
   if (readFailure) throw new Error("private failure detail");
   if (stored === undefined) return null;
   return { json: async () => { if (stored === "malformed") throw new Error("invalid JSON"); return stored; } };
  },
  put: async (key: string, value: string) => {
   assert.equal(key, APPEARANCE_KEY);
   if (writeFailure) throw new Error("private failure detail");
   stored = JSON.parse(value); writes++;
  },
 };
 const app = new Hono<any>(); registerAppearanceRoutes(app);
 return {
  get: () => app.request("https://inbox.example/api/v1/appearance", undefined, { BUCKET: bucket } as any),
  put: (value: unknown, headers: Record<string,string> = {}) => app.request("https://inbox.example/api/v1/appearance", {
   method: "PUT", headers: { Origin: "https://inbox.example", "Content-Type": "application/json", ...headers },body: JSON.stringify(value),
  }, { BUCKET: bucket } as any),
  writes: () => writes,
  failRead: () => { readFailure = true; }, failWrite: () => { writeFailure = true; },
 };
}
test("absent settings defaults without creating an R2 object", async () => {
 const f=fixture(); const res=await f.get(); assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{themeId:DEFAULT_THEME,error:null}); assert.equal(f.writes(),0);
 assert.equal(res.headers.get("Cache-Control"),"no-store");
});
test("all four themes roundtrip and last successful client write wins",async()=>{
 const f=fixture();
 for(const themeId of Object.keys(themes)){
  assert.equal((await f.put({themeId})).status,200);
  assert.deepEqual(await (await f.get()).json(),{themeId,error:null});
 }
 // Independent clients share the app-wide object; no CAS/realtime/polling.
 await f.put({themeId:"amethyst-dark"}); await f.put({themeId:"sakura-dark"});
 assert.deepEqual(await (await f.get()).json(),{themeId:"sakura-dark",error:null});
});
test("rejects invalid shapes, IDs, inherited property names and malformed JSON",async()=>{
 const f=fixture();
 for(const value of [{themeId:"unknown"},{themeId:"__proto__"},{themeId:"constructor"},{themeId:4},{themeId:null},null,[],{}, {themeId:DEFAULT_THEME,extra:true}]) assert.equal((await f.put(value)).status,400);
 assert.equal(f.writes(),0);
});
test("same-origin mutation boundary and body limit",async()=>{
 const f=fixture();
 for(const origin of ["https://evil.example","null",""]) assert.equal((await f.put({themeId:DEFAULT_THEME},{Origin:origin})).status,403);
 assert.equal((await f.put({themeId:DEFAULT_THEME},{"Sec-Fetch-Site":"cross-site"})).status,403);
 assert.equal((await f.put({themeId:DEFAULT_THEME},{"Content-Type":"text/plain"})).status,415);
 assert.equal((await f.put({themeId:"x".repeat(2000)})).status,413); assert.equal(f.writes(),0);
});
test("corrupt settings are distinct from missing and cannot be overwritten",async()=>{
 for(const initial of ["malformed",{themeId:"retired"},{themeId:4},null]){
  const f=fixture(initial); const res=await f.get(); assert.equal(res.status,503);
  assert.deepEqual(await res.json(),{themeId:DEFAULT_THEME,error:"corrupt"});
  assert.equal((await f.put({themeId:"sakura-dark"})).status,503);assert.equal(f.writes(),0);
 }
});
test("read failures safely fall back, block saving and never leak exception details",async()=>{
 const f=fixture();f.failRead();const res=await f.get();assert.equal(res.status,503);
 assert.deepEqual(await res.json(),{themeId:DEFAULT_THEME,error:"read-failed"});
 const update=await f.put({themeId:"sakura-dark"});assert.equal(update.status,503);
 assert.ok(!(await update.text()).includes("private")); assert.equal(f.writes(),0);
});
test("write failure does not claim success or replace saved setting",async()=>{
 const f=fixture({themeId:DEFAULT_THEME});f.failWrite();const res=await f.put({themeId:"sakura-dark"});
 assert.equal(res.status,503);assert.ok(!(await res.text()).includes("private"));
 assert.equal((await (await f.get()).json() as any).themeId,DEFAULT_THEME);assert.equal(f.writes(),0);
});
function luminance(hex: string){
 const channels=hex.slice(1).match(/../g)!.map(c=>parseInt(c,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
}
function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test("all palettes meet text and meaningful boundary/state contrast",()=>{
 for(const [id,theme] of Object.entries(themes)){
  const c=theme.colors;
  for(const bg of [c.canvas,c.surface,c.surfaceContainer,c.surfaceElevated,c.mailUnread,c.mailSelected,c.mailHover,c.navActive,c.tagNeutral]){
   for(const fg of [c.onSurface,c.onSurfaceMuted]) assert.ok(contrast(fg,bg)>=4.5,`${id} text ${fg}/${bg} ${contrast(fg,bg)}`);
  }
  for(const [fg,bg] of [[c.onPrimary,c.primary],[c.onPrimaryContainer,c.primaryContainer],[c.danger,c.dangerContainer],[c.onDanger,c.danger]]) assert.ok(contrast(fg,bg)>=4.5,`${id} button/error ${fg}/${bg}`);
  for(const bg of [c.canvas,c.surface,c.surfaceContainer,c.surfaceElevated,c.mailSelected,c.mailUnread]){
   for(const fg of [c.outline,c.focus,c.primary]) assert.ok(contrast(fg,bg)>=3,`${id} boundary ${fg}/${bg} ${contrast(fg,bg)}`);
   for(const fg of [c.danger,c.success,c.warning,c.mailStar]) assert.ok(contrast(fg,bg)>=4.5,`${id} semantic text ${fg}/${bg} ${contrast(fg,bg)}`);
  }
 }
});
test("malformed and empty request bodies are rejected without writes",async()=>{
 const app=new Hono<any>();registerAppearanceRoutes(app);let writes=0;
 const bucket={get:async()=>null,put:async()=>{writes++;}};
 for(const body of ['{broken','',JSON.stringify('sakura-dark')]){
  const response=await app.request('https://inbox.example/api/v1/appearance',{method:'PUT',headers:{Origin:'https://inbox.example','Content-Type':'application/json'},body},{BUCKET:bucket} as any);
  assert.equal(response.status,400);
 }
 assert.equal(writes,0);
});
test("concurrent clients use the last completed R2 write",async()=>{
 let stored:any;const completions:Array<()=>void>=[];
 const bucket={get:async()=>stored?{json:async()=>stored}:null,
  put:(_key:string,value:string)=>new Promise<void>(resolve=>{completions.push(()=>{stored=JSON.parse(value);resolve();});})};
 const app=new Hono<any>();registerAppearanceRoutes(app);
 const put=(themeId:string)=>app.request('https://inbox.example/api/v1/appearance',{method:'PUT',headers:{Origin:'https://inbox.example','Content-Type':'application/json'},body:JSON.stringify({themeId})},{BUCKET:bucket} as any);
 const first=put('amethyst-dark'),second=put('sakura-dark');
 for(let i=0;completions.length<2 && i<100;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(completions.length,2);
 completions[1]();assert.equal((await second).status,200);
 completions[0]();assert.equal((await first).status,200);
 assert.deepEqual(stored,{themeId:'amethyst-dark'});
});

test("primary and destructive hover colors retain paired text contrast",()=>{
 function mix(a:string,b:string){return "#"+[0,1,2].map(i=>Math.round(parseInt(a.slice(1+i*2,3+i*2),16)*.9+parseInt(b.slice(1+i*2,3+i*2),16)*.1).toString(16).padStart(2,"0")).join("");}
 for(const [id,{colors:c}] of Object.entries(themes)){
  assert.ok(contrast(c.onPrimary,c.onPrimaryContainer)>=4.5,`${id} primary hover`);
  assert.ok(contrast(c.onDanger,mix(c.danger,c.onSurface))>=4.5,`${id} danger hover`);
 }
});
