/*
 * GiganteFinder – endpoint para servidores reais do Roblox e relatos da comunidade.
 * IMPORTANTE: a API pública Roblox NÃO identifica pets presentes num servidor.
 * Relatos de pets não são detecções automáticas e não estão verificados.
 */
import { createHash, randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const PLACE_ID = '107778070777162';
const AGE_MS = 25 * 60 * 1000;
const DELAY_MS = 90 * 1000;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const commonHeaders = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' };
function json(data, status=200){ return new Response(JSON.stringify(data),{status,headers:{...commonHeaders,'Content-Type':'application/json; charset=utf-8'}}); }
function error(message,status=400){return json({ok:false,error:message},status);}
function clean(v,max){return typeof v==='string' ? v.trim().replace(/[\u0000-\u001f<>]/g,'').replace(/\s+/g,' ').slice(0,max):'';}
function store(name){return getStore({name,consistency:'strong'});}
function ipHash(req){const ip=req.headers.get('x-nf-client-connection-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'anonymous';return createHash('sha256').update('gigantefinder-v2:'+ip).digest('hex');}
async function robloxFetch(url){
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
    if(response.status===429)throw Object.assign(new Error('O Roblox limitou as consultas. Espere um pouco e tente de novo.'),{status:429});
    if(!response.ok)throw Object.assign(new Error('O Roblox não respondeu à lista de servidores (HTTP '+response.status+').'),{status:502});
    const body=await response.json();
    if(!Array.isArray(body.data))throw Object.assign(new Error('A lista retornada pelo Roblox está inválida.'),{status:502});
    return body;
  }finally{clearTimeout(timeout);}
}
async function serverList(url){
  const order=url.searchParams.get('order')==='Desc'?'Desc':'Asc';
  const rawCursor=url.searchParams.get('cursor')||'';
  if(rawCursor.length>900)return error('Página de pesquisa inválida.');
  const query=new URL(`https://games.roblox.com/v1/games/${PLACE_ID}/servers/Public`);
  query.searchParams.set('sortOrder',order);
  query.searchParams.set('limit','50');
  query.searchParams.set('excludeFullGames','true');
  if(rawCursor) query.searchParams.set('cursor',rawCursor);
  const response=await robloxFetch(query.toString());
  return json({ok:true,source:'Lista pública do Roblox',placeId:PLACE_ID,
    servers:response.data.filter(x=>UUID.test(x.id) && Number.isInteger(x.playing) && Number.isInteger(x.maxPlayers))
      .map(x=>({id:x.id,playing:x.playing,maxPlayers:x.maxPlayers,ping:Number.isFinite(x.ping)?Math.round(x.ping):null,fps:Number.isFinite(x.fps)?Math.round(x.fps):null})),
    nextCursor:typeof response.nextPageCursor==='string'?response.nextPageCursor:null,
    checkedAt:new Date().toISOString()});
}
async function recentReports(){
  const blobs=store('gigantefinder-reports');
  const {blobs:entries}=await blobs.list({prefix:'r/'});
  // Read at most the most recent 160 entries to keep function bounded.
  const keys=entries.map(x=>x.key).sort().slice(0,160);
  const raw=await Promise.all(keys.map(async key=>{
    try{return {key,value:await blobs.get(key,{type:'json'})};}catch{return {key,value:null};}
  }));
  const now=Date.now();
  const valid=[];
  for(const {key,value:r} of raw){
    if(!r||typeof r.createdAt!=='string')continue;
    const age=now-Date.parse(r.createdAt);
    if(age>=AGE_MS){blobs.delete(key).catch(()=>{});continue;}
    if(age<0 || !UUID.test(r.serverId))continue;
    valid.push({id:r.id,pet:r.pet,serverId:r.serverId,proof:r.proof||'',createdAt:r.createdAt,verified:false});
  }
  return valid.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
async function reportList(url){
  const wanted=clean(url.searchParams.get('pet')||'',60).toLocaleLowerCase('pt-BR');
  const all=await recentReports();
  const filtered= wanted? all.filter(r=>r.pet.toLocaleLowerCase('pt-BR').includes(wanted)):all;
  return json({ok:true,source:'Relatos enviados pela comunidade (não verificados)',expireMinutes:25,results:filtered.slice(0,80)});
}
async function createReport(request){
  if(!(request.headers.get('content-type')||'').includes('application/json'))return error('Envie o relatório no formato JSON.');
  const origin=request.headers.get('origin');
  if(origin && new URL(origin).host!==new URL(request.url).host)return error('Origem inválida.',403);
  const body=await request.text();
  if(body.length>1800)return error('Dados muito longos.',413);
  let input; try{input=JSON.parse(body);}catch{return error('Dados inválidos.');}
  const pet=clean(input?.pet,56);
  const serverId=clean(input?.serverId,64).toLowerCase();
  const proof=clean(input?.proof,400);
  if(pet.length<2)return error('Escreva o nome do pet (mínimo 2 letras).');
  if(!UUID.test(serverId))return error('Digite um Job ID válido (ex.: 12345678-abcd-1234-abcd-123456789abc).');
  if(input?.confirm!==true)return error('Confirme que você realmente viu o pet no servidor.');
  if(proof){
    try{const u=new URL(proof); if(u.protocol!=='https:' || !u.hostname.includes('.'))return error('O link de prova deve começar com https://');}
    catch{return error('Link de prova inválido.');}
  }
  const limiter=store('gigantefinder-rate-limits');
  const key='ip/'+ipHash(request); const prev=await limiter.get(key,{type:'json'});
  if(prev && Date.now()-prev.time<DELAY_MS)return error('Espere cerca de 90 segundos antes de registrar outro avistamento.',429);
  const record={id:randomUUID(),pet,serverId,proof,createdAt:new Date().toISOString(),type:'community'};
  // Newest records sort first alphabetically.
  const reverseTime=String(9999999999999-Date.now()).padStart(13,'0');
  await store('gigantefinder-reports').setJSON(`r/${reverseTime}-${record.id}`,record,{onlyIfNew:true});
  await limiter.setJSON(key,{time:Date.now()});
  return json({ok:true,report:{...record,verified:false}},201);
}
export default async function handler(request){
  try {
    const url=new URL(request.url);const action=url.searchParams.get('action')||'';
    if(request.method==='GET' && action==='health')return json({ok:true,site:'GiganteFinder',placeId:PLACE_ID});
    if(request.method==='GET' && action==='servers')return await serverList(url);
    if(request.method==='GET' && action==='reports')return await reportList(url);
    if(request.method==='POST' && action==='report')return await createReport(request);
    return error('Ação não encontrada.',404);
  }catch(e){
    console.error('GiganteFinder function:',e);
    if(e?.status===429 || e?.status===502)return error(e.message,e.status);
    return error('Serviço temporariamente indisponível. Confira se a função Netlify foi publicada.',503);
  }
}
