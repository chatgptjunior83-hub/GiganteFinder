(()=>{
  'use strict';
  const PLACE_ID='107778070777162';
  const BASE='/.netlify/functions/api';
  const $=id=>document.getElementById(id);
  const state={reports:[],pet:'',serverMap:new Map(),cursor:null,order:'Asc',loading:false,checkedAt:null,job:null};
  let toastTimeout;
  const jobRe=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  const fmt=new Intl.NumberFormat('pt-BR');
  const div=(cls,text)=>{const el=document.createElement('div');if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  function toast(msg,bad=false){const el=$('toast');el.textContent=msg;el.className='toast'+(bad?' error':'');el.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.hidden=true,4500);}
  async function api(action,params={},options={}){
    const url=new URL(BASE,location.origin);url.searchParams.set('action',action);
    for(const [k,v] of Object.entries(params))if(v!==null&&v!==undefined&&v!=='')url.searchParams.set(k,v);
    let res;
    try{res=await fetch(url,{cache:'no-store',headers:{'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{})},...options});}
    catch{throw Error('Não foi possível conectar. Confira sua internet e o deploy da Netlify.');}
    const data=await res.json().catch(()=>null);
    if(!res.ok||!data?.ok)throw Error(data?.error||`A consulta falhou (HTTP ${res.status}).`);
    return data;
  }
  const shortId=id=>id.length>21?id.slice(0,12)+'…'+id.slice(-7):id;
  const age=iso=>{const minutes=Math.max(0,Math.floor((Date.now()-Date.parse(iso))/60000));if(minutes<1)return 'agora';return minutes===1?'há 1 minuto':`há ${minutes} min`;};
  const add=(parent,...els)=>{for(const el of els)parent.appendChild(el);return parent;};
  function empty(place,title,description,button){
    const wrapper=div('placeholder-card');const symbol=div('empty-symbol','◎');const strong=document.createElement('strong');strong.textContent=title;
    const p=document.createElement('p');p.textContent=description;add(wrapper,symbol,strong,p);
    if(button){const b=document.createElement('a');b.className='btn btn-outline';b.href=button.href;b.textContent=button.text;wrapper.appendChild(b);}
    place.replaceChildren(wrapper);
  }
  async function loadReports(){
    $('refreshReports').disabled=true;
    $('reportSub').textContent='Atualizando relatos da comunidade...';
    try{
      const data=await api('reports',{pet:state.pet});state.reports=data.results;updatePetOptions(data.results);renderReports();
    }catch(e){empty($('reportResults'),'Não foi possível consultar os relatos',e.message);$('reportSub').textContent='Serviço indisponível';}
    finally{$('refreshReports').disabled=false;}
  }
  function updatePetOptions(reports){
    const dl=$('petsKnown');const names=new Set([...dl.options].map(o=>o.value));
    for(const report of reports){if(!names.has(report.pet)){const o=document.createElement('option');o.value=report.pet;dl.appendChild(o);names.add(report.pet);}}
  }
  function renderReports(){
    const list=$('reportResults');list.replaceChildren();
    $('reportCount').textContent=`${fmt.format(state.reports.length)} AVISTAMENTO${state.reports.length===1?'':'S'} RECENTE${state.reports.length===1?'':'S'}`;
    $('reportSub').textContent=state.pet?`Filtro: ${state.pet}`:'Todos os pets • relatados nos últimos 25 minutos';
    if(!state.reports.length){empty(list,'Nenhum gigante registrado agora','Não há relatos recentes para este pet. Você pode explorar servidores públicos ou voltar mais tarde.',{text:'Explorar servidores ↗',href:'#servidores'});return;}
    for(const item of state.reports){
      const card=div('sighting-card');const top=div('report-top');const tag=div('report-tag','NÃO VERIFICADO');const time=div('report-age',age(item.createdAt));add(top,tag,time);
      const title=document.createElement('h3');title.textContent=item.pet;const job=div('report-job','Job ID: '+shortId(item.serverId));const actions=div('report-actions');
      const go=document.createElement('button');go.type='button';go.className='btn btn-primary';go.textContent='Tentar entrar ↗';go.addEventListener('click',()=>openJoin(item.serverId));
      const copy=document.createElement('button');copy.className='copy-mini';copy.type='button';copy.textContent='Copiar ID';copy.addEventListener('click',()=>copyText(item.serverId));add(actions,go,copy);
      add(card,top,title,job,actions);
      if(item.proof){try{const u=new URL(item.proof);if(u.protocol==='https:'){const a=document.createElement('a');a.className='proof-link';a.textContent='Ver link de prova ↗';a.href=u.href;a.target='_blank';a.rel='noopener noreferrer nofollow';card.appendChild(a);}}catch{}}
      list.appendChild(card);
    }
  }
  const filteredRooms=()=>[...state.serverMap.values()].filter(x=>(x.maxPlayers-x.playing)>=Number($('slots').value)).sort((a,b)=>state.order==='Asc'?a.playing-b.playing:b.playing-a.playing);
  function updateRoomList(){
    const list=$('serverResults');list.replaceChildren();const rooms=filteredRooms();
    $('serverMetrics').textContent=`${rooms.length} exibido${rooms.length===1?'':'s'} · ${state.serverMap.size} carregado${state.serverMap.size===1?'':'s'}`;
    $('moreServers').hidden=!state.cursor;
    if(!rooms.length){list.innerHTML='<div class="server-empty"><span class="empty-symbol">⌁</span><h3>NENHUMA SALA COM ESSES FILTROS</h3><p>Tente diminuir o número de vagas mínimas ou carregar mais páginas.</p></div>';return;}
    for(let i=0;i<rooms.length;i++){
      const s=rooms[i];const row=div('server-item');const n=div('server-number',String(i+1).padStart(2,'0'));
      const main=div('server-core');const head=document.createElement('strong');head.textContent=`Sala pública #${String(i+1).padStart(3,'0')}`;
      const code=document.createElement('span');code.textContent=shortId(s.id);add(main,head,code);
      const bar=div('occupancy');const fill=document.createElement('i');fill.style.width=(100*s.playing/Math.max(1,s.maxPlayers))+'%';bar.appendChild(fill);
      const info=div('room-slots');const num=document.createElement('b');num.textContent=`${s.playing}/${s.maxPlayers}`;info.append(num,document.createTextNode(` · ${s.maxPlayers-s.playing} vagas`));
      const button=document.createElement('button');button.className='btn btn-outline';button.type='button';button.textContent='Entrar ↗';button.addEventListener('click',()=>openJoin(s.id));
      add(row,n,main,bar,info,button);list.appendChild(row);
    }
  }
  async function loadServers(reset=false){
    if(state.loading)return;
    state.loading=true;$('loadServers').disabled=true;$('moreServers').disabled=true;
    if(reset){state.cursor=null;state.serverMap.clear();state.order=$('sort').value;$('serverResults').innerHTML='<div class="server-empty"><span class="empty-symbol">⌕</span><h3>CONSULTANDO ROBLOX...</h3><p>Procurando servidores públicos com vagas.</p></div>';}
    try{
      const data=await api('servers',{order:state.order,cursor:state.cursor});
      for(const s of data.servers){if(jobRe.test(s.id) && s.maxPlayers>s.playing)state.serverMap.set(s.id,s);}
      state.cursor=data.nextCursor;state.checkedAt=data.checkedAt;updateRoomList();
      if(!state.serverMap.size)toast('O Roblox não retornou salas com vagas nesta página.');
    }catch(e){
      if(!state.serverMap.size)$('serverResults').innerHTML='';
      if(!state.serverMap.size){const box=div('server-empty');add(box,div('empty-symbol','!'),div('','Não foi possível carregar as salas'),div('',e.message));$('serverResults').appendChild(box);}
      else toast(e.message,true);
      $('serverMetrics').textContent='Consulta indisponível no momento';
    }finally{state.loading=false;$('loadServers').disabled=false;$('moreServers').disabled=false;}
  }
  function openJoin(job){
    if(!jobRe.test(job)){toast('ID de servidor inválido.',true);return;}
    state.job=job;$('joinJob').textContent=job;
    const uri=`roblox://placeId=${PLACE_ID}&gameInstanceId=${encodeURIComponent(job)}`;
    $('joinDirect').href=uri;
    $('joinOverlay').hidden=false;
  }
  async function copyText(str){try{await navigator.clipboard.writeText(str);toast('ID do servidor copiado!');}catch{toast('Não foi possível copiar automaticamente.',true);}}
  $('closeJoin').addEventListener('click',()=>$('joinOverlay').hidden=true);
  $('joinOverlay').addEventListener('click',e=>{if(e.target===$('joinOverlay'))$('joinOverlay').hidden=true;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')$('joinOverlay').hidden=true;});
  $('copyJob').addEventListener('click',()=>state.job&&copyText(state.job));
  $('searchForm').addEventListener('submit',e=>{e.preventDefault();state.pet=$('petSearch').value.trim();loadReports();});
  $('refreshReports').addEventListener('click',loadReports);
  $('clearSearch').addEventListener('click',()=>{$('petSearch').value='';state.pet='';loadReports();});
  $('loadServers').addEventListener('click',()=>loadServers(true));
  $('moreServers').addEventListener('click',()=>loadServers(false));
  $('sort').addEventListener('change',()=>loadServers(true));
  $('slots').addEventListener('change',updateRoomList);
  $('reportForm').addEventListener('submit',async e=>{
    e.preventDefault();const out=$('formFeedback');out.textContent='Enviando avistamento...';out.className='form-feedback';
    const data={pet:$('reportPet').value.trim(),serverId:$('reportJob').value.trim(),proof:$('reportProof').value.trim(),confirm:$('confirmReport').checked};
    if(!jobRe.test(data.serverId)){out.textContent='Cole um Job ID válido (UUID do servidor).';out.className='form-feedback error';return;}
    $('sendReport').disabled=true;
    try{await api('report',{}, {method:'POST',body:JSON.stringify(data)});out.textContent='Avistamento registrado! Ele será exibido como relato NÃO VERIFICADO.';out.className='form-feedback success';$('reportForm').reset();state.pet='';$('petSearch').value='';await loadReports();}
    catch(err){out.textContent=err.message;out.className='form-feedback error';}
    finally{$('sendReport').disabled=false;}
  });
  // Nothing is fabricated when no sightings exist.
  loadReports();
})();
