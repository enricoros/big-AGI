import fs from 'node:fs'; import path from 'node:path';
import { OUT, apiKey, MODEL } from './lib.mjs';
const d = JSON.parse(fs.readFileSync(path.join(OUT,'s2a_hosted_dynamic.json'),'utf8'));
const container = d.turns.find(t=>t.container)?.container?.id;
const base = d.finalMessages.concat([{role:'user',content:'In one line, restate the Iceland population number.'}]);
const tools=[{type:'web_search_20260318',name:'web_search',max_uses:5},{type:'web_fetch_20260318',name:'web_fetch',max_uses:3}];
async function call(withC){const b={model:MODEL,max_tokens:60,messages:base,tools,...(withC&&container?{container}:{})};
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':apiKey(),'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify(b)});
  const j=await r.json(); return {status:r.status, stop:j.stop_reason, in:j.usage?.input_tokens, err:j.error?.message};}
// does the completed dynamic-filtering history still contain code-exec blocks?
const asst=d.finalMessages.find(m=>m.role==='assistant');
const codeExecBlocks=asst.content.filter(b=>b.type==='server_tool_use'&&b.name==='code_execution').length;
console.log('completed s2a turn has', codeExecBlocks, 'code_execution blocks in history; container=', container?.slice(-8));
console.log('WITH container:   ', JSON.stringify(await call(true)));
console.log('WITHOUT container:', JSON.stringify(await call(false)));
