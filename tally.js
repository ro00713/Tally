// ════════════════════════════════════════
//  PROFILE PAGE
// ════════════════════════════════════════
(function(){
  function $id(id){ return document.getElementById(id); }
  function fmtBytes(b){ if(b<1024) return b+'B'; if(b<1048576) return (b/1024).toFixed(1)+'KB'; return (b/1048576).toFixed(2)+'MB'; }

  function openProfilePage(){
    $id('appShell').classList.add('hidden');
    $id('graphSheetPage').classList.remove('visible');
    $id('profilePage').classList.add('visible');
    populateProfile();
  }
  function closeProfilePage(){
    $id('profilePage').classList.remove('visible');
    $id('appShell').classList.remove('hidden');
  }

  function populateProfile(){
    const uid = window.currentUserId||'—';
    const av=$id('ppBigAvatar'); if(av) av.textContent=uid&&uid!=='—'?uid[0].toUpperCase():'?';
    if($id('ppUsernameTag')) $id('ppUsernameTag').textContent=uid!=='—'?`@${uid}`:'@—';
    if($id('ppUserIdText')) $id('ppUserIdText').textContent=uid;
    if($id('ppModalUsername')) $id('ppModalUsername').textContent=uid;
    const joinKey=`tally:user:${uid}:joined`;
    let joined=localStorage.getItem(joinKey);
    if(!joined){ joined=new Date().toISOString().slice(0,10); localStorage.setItem(joinKey,joined); }
    if($id('ppMemberSince')) $id('ppMemberSince').textContent=new Date(joined).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
    const txRaw=localStorage.getItem(`tally:user:${uid}:transactions`);
    const txList=txRaw?JSON.parse(txRaw):[];
    if($id('ppTotalEntries')) $id('ppTotalEntries').textContent=txList.length+' entries';
    let bytes=0; const pfx=`tally:user:${uid}:`;
    for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith(pfx)) bytes+=(localStorage.getItem(k)||'').length*2; }
    if($id('ppStorageUsed')) $id('ppStorageUsed').textContent=fmtBytes(bytes);
    const profRaw=localStorage.getItem(`tally:user:${uid}:profile`);
    const prof=profRaw?JSON.parse(profRaw):{};
    if($id('ppEditName')) $id('ppEditName').value=prof.name||'';
    if($id('ppEditEmail')) $id('ppEditEmail').value=prof.email||'';
    if($id('ppEditPhone')) $id('ppEditPhone').value=prof.phone||'';
    if($id('ppDisplayName')) $id('ppDisplayName').textContent=prof.name||uid||'—';
  }

  const copyBtn=$id('ppCopyId');
  if(copyBtn) copyBtn.addEventListener('click',()=>{
    navigator.clipboard.writeText(window.currentUserId||'').catch(()=>{});
    copyBtn.textContent='✅'; setTimeout(()=>copyBtn.textContent='📋',1500);
  });

  const saveBtn=$id('ppSaveBtn');
  if(saveBtn) saveBtn.addEventListener('click',()=>{
    const uid=window.currentUserId; if(!uid) return;
    const prof={name:($id('ppEditName').value||'').trim(),email:($id('ppEditEmail').value||'').trim(),phone:($id('ppEditPhone').value||'').trim()};
    localStorage.setItem(`tally:user:${uid}:profile`,JSON.stringify(prof));
    if($id('ppDisplayName')) $id('ppDisplayName').textContent=prof.name||uid;
    if($id('ppBigAvatar')) $id('ppBigAvatar').textContent=(prof.name||uid)[0].toUpperCase();
    if(window.renderProfileStrip) window.renderProfileStrip(prof);
    if(window.showToast) window.showToast('Profile saved ✓','success'); else alert('Saved!');
  });

  const deleteBtn=$id('ppDeleteBtn'), modal=$id('ppDeleteModal'), cancelBtn=$id('ppModalCancel'), confirmBtn=$id('ppModalConfirm'), modalInput=$id('ppModalInput');
  if(deleteBtn) deleteBtn.addEventListener('click',()=>{ modal.classList.remove('hidden'); if(modalInput){modalInput.value='';modalInput.focus();} if(confirmBtn) confirmBtn.disabled=true; });
  if(cancelBtn) cancelBtn.addEventListener('click',()=>modal.classList.add('hidden'));
  if(modal) modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.add('hidden'); });
  if(modalInput) modalInput.addEventListener('input',()=>{ if(confirmBtn) confirmBtn.disabled=modalInput.value.trim()!==(window.currentUserId||''); });
  if(confirmBtn) confirmBtn.addEventListener('click',()=>{
    const uid=window.currentUserId; if(!uid) return;
    const keys=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith(`tally:user:${uid}:`)) keys.push(k); }
    keys.forEach(k=>localStorage.removeItem(k));
    try{ const lr=localStorage.getItem('tally:users'); const l=lr?JSON.parse(lr):[]; localStorage.setItem('tally:users',JSON.stringify(l.filter(u=>u!==uid))); }catch(e){}
    modal.classList.add('hidden');
    window.currentUserId=null;
    $id('profilePage').classList.remove('visible');
    if(window.showToast) window.showToast('Account deleted. Goodbye 👋','success');
    setTimeout(()=>{ $id('appShell').classList.add('hidden'); const a=document.getElementById('authScreen')||document.getElementById('loginScreen'); if(a) a.classList.remove('hidden'); else location.reload(); },1200);
  });

  if($id('ppBackBtn')) $id('ppBackBtn').addEventListener('click',closeProfilePage);
  const sbBtn=$id('sbNavProfile');
  if(sbBtn) sbBtn.addEventListener('click',()=>{
    document.getElementById('sidebar').classList.remove('mobile-open');
    const ov=document.getElementById('sbMobileOverlay'); if(ov) ov.classList.remove('active');
    openProfilePage();
  });
  window.openProfilePage=openProfilePage;
})();

// ════════════════════════════════════════
//  GRAPH SHEET
// ════════════════════════════════════════
(function(){
  function fmtCur(v){ return '₹'+Math.abs(v).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:0}); }
  function getISOWeek(d){ const date=new Date(d); date.setHours(0,0,0,0); date.setDate(date.getDate()+3-(date.getDay()+6)%7); const w1=new Date(date.getFullYear(),0,4); return [date.getFullYear(),1+Math.round(((date-w1)/86400000-3+(w1.getDay()+6)%7)/7)]; }
  function weekKey(ds){ const [y,w]=getISOWeek(new Date(ds)); return y+'-W'+(w<10?'0':'')+w; }
  function weekLabel(key){ const [yr,wn]=key.split('-W'); const j=new Date(parseInt(yr),0,4); const dw=(j.getDay()+6)%7; const mon=new Date(j); mon.setDate(j.getDate()-dw+(parseInt(wn)-1)*7); return 'W'+wn+' '+mon.toLocaleString('default',{month:'short'}); }
  const COLS=['#7C3AED','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#84CC16','#F97316'];
  const CATS=["Food","Transport","Housing","Utilities","Entertainment","Shopping","Health","Education","Other"];
  function catColor(c){ return COLS[CATS.indexOf(c)%COLS.length]||COLS[0]; }

  function barPairChart(id,labels,incomes,expenses,showBal,balances){
    const wrap=document.getElementById(id); if(!wrap) return;
    const W=Math.max(wrap.clientWidth,500),H=200,PL=50,PR=14,PT=14,PB=26;
    const n=labels.length; const maxV=Math.max(1,...incomes,...expenses);
    const gW=(W-PL-PR)/n; const bw=Math.min(13,gW*0.28); const pH=H-PT-PB;
    const yB=v=>PT+pH-(v/maxV)*pH;
    let yL='',bars='',line='',dots='';
    for(let i=0;i<=4;i++){ const v=(maxV/4)*i; const y=yB(v); yL+=`<text x="${PL-4}" y="${y+3}" text-anchor="end" font-size="9" fill="var(--muted)" font-family="Space Mono,monospace">${fmtCur(v)}</text><line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="var(--paper-line)" stroke-width="0.5"/>`; }
    labels.forEach((l,i)=>{ const cx=PL+gW*i+gW/2; const ih=(incomes[i]/maxV)*pH; const eh=(expenses[i]/maxV)*pH; bars+=`<rect x="${cx-bw-1}" y="${yB(incomes[i])}" width="${bw}" height="${Math.max(1,ih)}" fill="var(--sage)" rx="1"/><rect x="${cx+1}" y="${yB(expenses[i])}" width="${bw}" height="${Math.max(1,eh)}" fill="var(--rust)" rx="1"/><text x="${cx}" y="${H-8}" text-anchor="middle" font-size="9" fill="var(--muted)" font-family="Space Mono,monospace">${l}</text>`; });
    if(showBal&&balances&&balances.length===n){ const mn=Math.min(0,...balances),mx=Math.max(1,...balances),r=(mx-mn)||1; const yBl=v=>PT+pH-((v-mn)/r)*pH; const pts=balances.map((b,i)=>[PL+gW*i+gW/2,yBl(b)]); line=`<path d="${pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')}" fill="none" stroke="var(--brass)" stroke-width="2"/>`; dots=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="var(--brass)"/>`).join(''); }
    wrap.innerHTML=`<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${yL}${bars}${line}${dots}</svg>`;
  }

  function lineChart(id,labels,values,color,fill){
    const wrap=document.getElementById(id); if(!wrap) return;
    const W=Math.max(wrap.clientWidth,500),H=150,PL=50,PR=14,PT=14,PB=26;
    const n=labels.length; if(!n) return;
    const mn=Math.min(0,...values),mx=Math.max(1,...values),r=(mx-mn)||1;
    const pH=H-PT-PB; const yL=v=>PT+pH-((v-mn)/r)*pH; const xL=i=>PL+((W-PL-PR)/(n-1||1))*i;
    let yLabels='';
    for(let i=0;i<=4;i++){ const v=mn+(r/4)*i; const y=yL(v); yLabels+=`<text x="${PL-4}" y="${y+3}" text-anchor="end" font-size="9" fill="var(--muted)" font-family="Space Mono,monospace">${v.toFixed(0)}${fill?'%':''}</text><line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="var(--paper-line)" stroke-width="0.5"/>`; }
    const pts=values.map((v,i)=>[xL(i),yL(v)]);
    const lp=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    let areaPath=''; if(fill){ const by=yL(0); areaPath=`<path d="M${pts[0][0]} ${by} ${pts.map(p=>`L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')} L${pts[pts.length-1][0]} ${by} Z" fill="${color}" opacity="0.12"/>`; }
    const xlbls=labels.map((l,i)=>`<text x="${xL(i)}" y="${H-8}" text-anchor="middle" font-size="9" fill="var(--muted)" font-family="Space Mono,monospace">${l}</text>`).join('');
    const ddots=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${color}"/>`).join('');
    wrap.innerHTML=`<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${yLabels}${areaPath}<path d="${lp}" fill="none" stroke="${color}" stroke-width="2"/>${ddots}${xlbls}</svg>`;
  }

  function catCards(id,txList){
    const wrap=document.getElementById(id); if(!wrap) return;
    const totals={}; CATS.forEach(c=>totals[c]=0);
    txList.filter(t=>t.amount<0).forEach(t=>{ totals[t.category]=(totals[t.category]||0)+Math.abs(t.amount); });
    const max=Math.max(1,...Object.values(totals));
    wrap.innerHTML=CATS.filter(c=>totals[c]>0).map(c=>`<div class="gs-cat-card"><div class="gs-cat-name">${c}</div><div class="gs-cat-val">${fmtCur(totals[c])}</div><div class="gs-cat-bar-track"><div class="gs-cat-bar-fill" style="width:${(totals[c]/max*100).toFixed(1)}%;background:${catColor(c)};"></div></div></div>`).join('')||'<div style="color:var(--muted);font-size:13px;">No expenses yet.</div>';
  }

  function updateSummary(txList){
    const inc=txList.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
    const sp=txList.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
    const net=inc-sp; const rate=inc>0?((net/inc)*100):null;
    document.getElementById('gsSumIncome').textContent=inc?fmtCur(inc):'—';
    document.getElementById('gsSumSpent').textContent=sp?fmtCur(sp):'—';
    const ne=document.getElementById('gsSumNet'); ne.textContent=inc||sp?fmtCur(net):'—'; ne.className='gs-sum-val '+(net>=0?'pos':'neg');
    const re=document.getElementById('gsSumRate'); re.textContent=rate!==null?rate.toFixed(1)+'%':'—'; re.className='gs-sum-val '+(rate===null?'':rate>=20?'pos':rate>=0?'neutral':'neg');
  }

  function renderWeekly(){
    if(!window.transactions) return;
    const now=new Date(); const weeks=[];
    for(let i=11;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i*7); const [y,w]=getISOWeek(d); const key=y+'-W'+(w<10?'0':'')+w; if(!weeks.find(x=>x.key===key)) weeks.push({key,label:weekLabel(key)}); }
    const wd=weeks.map(({key,label})=>{ const tx=window.transactions.filter(t=>weekKey(t.date)===key); return {key,label,income:tx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0),expense:tx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0),tx}; });
    const all=[...window.transactions].sort((a,b)=>a.date.localeCompare(b.date)); let run=0,idx=0;
    const bals=wd.map(w=>{ while(idx<all.length&&weekKey(all[idx].date)<=w.key){run+=all[idx].amount;idx++;} return run; });
    barPairChart('gsWeeklyBarWrap',wd.map(d=>d.label),wd.map(d=>d.income),wd.map(d=>d.expense),false,null);
    lineChart('gsWeeklyBalWrap',wd.map(d=>d.label),bals,'var(--brass)',false);
    const twk=weekKey(now.toISOString().slice(0,10)); catCards('gsWeeklyCatGrid',window.transactions.filter(t=>weekKey(t.date)===twk));
    updateSummary(wd.flatMap(d=>d.tx));
  }

  function renderMonthly(){
    if(!window.transactions) return;
    const now=new Date(); const months=[];
    for(let i=11;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); months.push(d.toISOString().slice(0,7)); }
    const md=months.map(m=>{ const tx=window.transactions.filter(t=>t.date.slice(0,7)===m); const d=new Date(m+'-01T00:00:00'); return {m,label:d.toLocaleString('default',{month:'short'}),income:tx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0),expense:tx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0),tx}; });
    const all=[...window.transactions].sort((a,b)=>a.date.localeCompare(b.date)); let run=0,idx=0;
    const bals=md.map(m=>{ while(idx<all.length&&all[idx].date.slice(0,7)<=m.m){run+=all[idx].amount;idx++;} return run; });
    barPairChart('gsMonthlyBarWrap',md.map(d=>d.label),md.map(d=>d.income),md.map(d=>d.expense),true,bals);
    lineChart('gsMonthlySavingsWrap',md.map(d=>d.label),md.map(d=>d.income>0?((d.income-d.expense)/d.income*100):0),'var(--brass)',true);
    catCards('gsMonthlyCatGrid',window.transactions.filter(t=>t.date.slice(0,7)===now.toISOString().slice(0,7)));
    updateSummary(md.flatMap(d=>d.tx));
  }

  function renderYearly(){
    if(!window.transactions) return;
    const now=new Date(); const years=[]; for(let i=4;i>=0;i--) years.push(now.getFullYear()-i);
    const yd=years.map(yr=>{ const tx=window.transactions.filter(t=>parseInt(t.date.slice(0,4))===yr); const inc=tx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0); const exp=tx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0); return {yr,label:String(yr),income:inc,expense:exp,net:inc-exp,tx}; });
    const wrap=document.getElementById('gsYearlyBarWrap'); if(!wrap) return;
    const W=Math.max(wrap.clientWidth,400),H=200,PL=50,PR=14,PT=14,PB=26;
    const n=yd.length; const maxV=Math.max(1,...yd.map(d=>Math.max(d.income,d.expense)));
    const gW=(W-PL-PR)/n; const bw=Math.min(12,gW*0.22); const pH=H-PT-PB; const yB=v=>PT+pH-(v/maxV)*pH;
    let yL='',bars='';
    for(let i=0;i<=4;i++){ const v=(maxV/4)*i; const y=yB(v); yL+=`<text x="${PL-4}" y="${y+3}" text-anchor="end" font-size="9" fill="var(--muted)" font-family="Space Mono,monospace">${fmtCur(v)}</text><line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="var(--paper-line)" stroke-width="0.5"/>`; }
    yd.forEach((d,i)=>{ const cx=PL+gW*i+gW/2; bars+=`<rect x="${cx-bw*1.5-2}" y="${yB(d.income)}" width="${bw}" height="${Math.max(1,(d.income/maxV)*pH)}" fill="var(--sage)" rx="1"/><rect x="${cx-bw/2}" y="${yB(d.expense)}" width="${bw}" height="${Math.max(1,(d.expense/maxV)*pH)}" fill="var(--rust)" rx="1"/><rect x="${cx+bw/2+2}" y="${d.net>=0?yB(d.net):yB(0)}" width="${bw}" height="${Math.max(1,Math.abs(d.net)/maxV*pH)}" fill="var(--brass)" rx="1"/><text x="${cx}" y="${H-8}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="Space Mono,monospace">${d.label}</text>`; });
    wrap.innerHTML=`<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${yL}${bars}</svg>`;
    const cw=document.getElementById('gsYearlyCatWrap'); if(!cw) return;
    const CW=Math.max(cw.clientWidth,400),CH=180; const catTotals={}; CATS.forEach(c=>{ catTotals[c]=yd.map(d=>d.tx.filter(t=>t.amount<0&&t.category===c).reduce((s,t)=>s+Math.abs(t.amount),0)); });
    const maxC=Math.max(1,...CATS.flatMap(c=>catTotals[c])); const cgW=(CW-PL-PR)/n; const cbw=Math.min(10,cgW*0.18); const cpH=CH-PT-PB; const cyB=v=>PT+cpH-(v/maxC)*cpH;
    let cyL='',cbars='';
    for(let i=0;i<=4;i++){ const v=(maxC/4)*i; const y=cyB(v); cyL+=`<text x="${PL-4}" y="${y+3}" text-anchor="end" font-size="9" fill="var(--muted)" font-family="Space Mono,monospace">${fmtCur(v)}</text><line x1="${PL}" y1="${y}" x2="${CW-PR}" y2="${y}" stroke="var(--paper-line)" stroke-width="0.5"/>`; }
    yd.forEach((d,i)=>{ const cx=PL+cgW*i+cgW/2; const off=-((CATS.length/2)*cbw+CATS.length-1); CATS.forEach((c,ci)=>{ const v=catTotals[c][i]; if(!v) return; cbars+=`<rect x="${cx+off+ci*(cbw+1)}" y="${cyB(v)}" width="${cbw}" height="${Math.max(1,(v/maxC)*cpH)}" fill="${catColor(c)}" rx="1"/>`; }); cbars+=`<text x="${cx}" y="${CH-8}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="Space Mono,monospace">${d.label}</text>`; });
    cw.innerHTML=`<svg width="100%" height="${CH}" viewBox="0 0 ${CW} ${CH}" xmlns="http://www.w3.org/2000/svg">${cyL}${cbars}</svg>`;
    const leg=document.getElementById('gsYearlyCatLegend'); if(leg) leg.innerHTML=CATS.map(c=>`<span><span class="swatch" style="background:${catColor(c)};"></span>${c}</span>`).join('');
    updateSummary(yd.flatMap(d=>d.tx));
  }

  let activeTab='weekly';
  document.querySelectorAll('.gs-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      document.querySelectorAll('.gs-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active'); activeTab=tab.dataset.gstab;
      document.querySelectorAll('.gs-panel').forEach(p=>p.classList.remove('active'));
      document.getElementById('gs'+activeTab[0].toUpperCase()+activeTab.slice(1)+'Panel').classList.add('active');
      renderActiveTab();
    });
  });

  function renderActiveTab(){ if(activeTab==='weekly') renderWeekly(); else if(activeTab==='monthly') renderMonthly(); else renderYearly(); }

  function openGraphSheet(){
    document.getElementById('appShell').classList.add('hidden');
    document.getElementById('profilePage').classList.remove('visible');
    document.getElementById('graphSheetPage').classList.add('visible');
    setTimeout(renderActiveTab,60);
  }
  function closeGraphSheet(){
    document.getElementById('graphSheetPage').classList.remove('visible');
    document.getElementById('appShell').classList.remove('hidden');
  }

  document.getElementById('gsBackBtn').addEventListener('click',closeGraphSheet);
  const sbBtn=document.getElementById('sbNavGraphSheet');
  if(sbBtn) sbBtn.addEventListener('click',()=>{
    document.getElementById('sidebar').classList.remove('mobile-open');
    const ov=document.getElementById('sbMobileOverlay'); if(ov) ov.classList.remove('active');
    openGraphSheet();
  });
  window.openGraphSheet=openGraphSheet;
  window.renderGraphSheet_full=renderActiveTab;
})();

// ═══════════════════════════════════════════════════════
//  TALLY ENHANCED — Combined Script
// ═══════════════════════════════════════════════════════

const CATEGORIES = ["Food","Transport","Housing","Utilities","Entertainment","Shopping","Health","Education","Other"];
let transactions = [];
let budgets = {};
let goals = [];
let recurringItems = [];
let entryType = "expense";
const $ = id => document.getElementById(id);
const fmt = n => (n<0?"-":"") + "₹" + Math.abs(n).toFixed(2);
let currentUserId = null;

const CATEGORY_COLORS = {
  Food:"#F59E0B", Transport:"#10B981", Housing:"#3B82F6",
  Utilities:"#06B6D4", Entertainment:"#EF4444", Shopping:"#D97706",
  Health:"#8B5CF6", Education:"#6366F1", Other:"#64748B"
};
function categoryColor(c){ return CATEGORY_COLORS[c] || 'var(--brass)'; }

// ── Toast ──
let toastTimer;
function showToast(msg, type=''){
  const t = $('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.className = ''; }, 2600);
}

// ── localStorage helpers ──
function userKey(name){ return `tally:user:${currentUserId}:${name}`; }

async function loadData(){
  try{ const t = localStorage.getItem(userKey('transactions')); transactions = t ? JSON.parse(t) : []; }catch(e){ transactions = []; }
  try{ const b = localStorage.getItem(userKey('budgets')); budgets = b ? JSON.parse(b) : {}; }catch(e){ budgets = {}; }
  await loadGoals();
  await loadRecurring();
}
async function saveTransactions(){ try{ localStorage.setItem(userKey('transactions'), JSON.stringify(transactions)); }catch(e){} }
async function saveBudgets(){ try{ localStorage.setItem(userKey('budgets'), JSON.stringify(budgets)); }catch(e){} }

// ── SHA-256 ──
async function sha256Hex(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function sanitizeUserId(raw){ return raw.trim().toLowerCase().replace(/[^a-z0-9_.-]/g,''); }

// ── Category selects ──
function populateCategorySelect(){
  const sel = $('fCategory');
  sel.innerHTML = "";
  CATEGORIES.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
  // also populate edit modal and recurring
  ['editCat','recurCat'].forEach(id=>{
    const s = $(id); if(!s) return;
    s.innerHTML = "";
    CATEGORIES.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; s.appendChild(o); });
  });
}

function renderBudgetInputs(){
  const wrap = $('budgetInputs'); wrap.innerHTML = "";
  CATEGORIES.forEach(c=>{
    const row = document.createElement('div'); row.className='budget-row';
    row.innerHTML = `<span>${c}</span>`;
    const inp = document.createElement('input');
    inp.type='number'; inp.min='0'; inp.step='1'; inp.value=budgets[c]||''; inp.placeholder='—';
    inp.addEventListener('change', async ()=>{ budgets[c]=parseFloat(inp.value)||0; await saveBudgets(); renderAll(); });
    row.appendChild(inp); wrap.appendChild(row);
  });
}

// ── Entry type toggle ──
$('typeExpense').addEventListener('click', ()=>{
  entryType='expense';
  $('typeExpense').classList.add('active'); $('typeIncome').classList.remove('active');
  $('catLabel').textContent='Category'; $('fCategory').style.display='block';
});
$('typeIncome').addEventListener('click', ()=>{
  entryType='income';
  $('typeIncome').classList.add('active'); $('typeExpense').classList.remove('active');
  $('catLabel').textContent='Category (n/a for income)'; $('fCategory').style.display='none';
});

// ── Add entry ──
$('addBtn').addEventListener('click', async ()=>{
  const amt = parseFloat($('fAmount').value);
  if(!amt||amt<=0){ $('fAmount').focus(); return; }
  const desc = $('fDesc').value.trim() || (entryType==='income'?'Income':'Expense');
  const note = $('fNote').value.trim();
  const date = $('fDate').value || new Date().toISOString().slice(0,10);
  const category = entryType==='income' ? 'Income' : $('fCategory').value;
  const entry = {
    id: Date.now()+Math.random().toString(16).slice(2),
    date, desc, category, note,
    amount: entryType==='income' ? Math.abs(amt) : -Math.abs(amt)
  };
  transactions.push(entry);
  await saveTransactions();
  $('fAmount').value=''; $('fDesc').value=''; $('fNote').value='';
  renderAll();
  showToast('Entry added ✓', 'success');
});

// ── Ledger rendering ──
function monthKey(dateStr){ return dateStr.slice(0,7); }

function populateMonthFilter(){
  const sel = $('monthFilter');
  const months = Array.from(new Set(transactions.map(t=>monthKey(t.date))));
  const current = new Date().toISOString().slice(0,7);
  if(!months.includes(current)) months.push(current);
  months.sort().reverse();
  const prev = sel.value;
  sel.innerHTML = "";
  months.forEach(m=>{
    const o=document.createElement('option'); o.value=m;
    const d=new Date(m+"-01T00:00:00");
    o.textContent=d.toLocaleString('default',{month:'long',year:'numeric'});
    sel.appendChild(o);
  });
  sel.value = months.includes(prev) ? prev : current;
}

function computeLedger(){
  const sorted = [...transactions].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  let bal=0;
  const withBal = sorted.map(t=>{ bal+=t.amount; return {...t,balance:bal}; });
  return withBal.reverse();
}

function renderLedger(){
  const selectedMonth = $('monthFilter').value;
  const query = ($('searchInput')||{value:''}).value.trim().toLowerCase();
  const withBal = computeLedger();
  let filtered = withBal.filter(t=> monthKey(t.date)===selectedMonth);
  if(query) filtered = filtered.filter(t=>
    t.desc.toLowerCase().includes(query) ||
    t.category.toLowerCase().includes(query) ||
    (t.note||'').toLowerCase().includes(query)
  );
  const body = $('ledgerBody'); body.innerHTML="";
  $('emptyState').style.display = filtered.length?'none':'block';
  filtered.forEach(t=>{
    const tr=document.createElement('tr');
    const isExpense = t.amount<0;
    tr.innerHTML = `
      <td class="mono">${t.date}</td>
      <td>
        <div>${t.desc}</div>
        ${t.note ? `<div class="entry-note">📝 ${t.note}</div>` : ''}
      </td>
      <td><span class="cat-pill">${t.category}</span></td>
      <td class="num mono amt ${isExpense?'expense':'income'}">${fmt(t.amount)}</td>
      <td class="num mono">${fmt(t.balance)}</td>
      <td style="white-space:nowrap;">
        <button class="edit-btn" data-id="${t.id}" title="Edit">✏️</button>
        <button class="del-btn"  data-id="${t.id}" title="Delete">✕</button>
      </td>
    `;
    body.appendChild(tr);
  });
  body.querySelectorAll('.del-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(!confirm('Delete this entry?')) return;
      transactions = transactions.filter(t=>t.id!==btn.dataset.id);
      await saveTransactions(); renderAll();
      showToast('Entry deleted', 'error');
    });
  });
  body.querySelectorAll('.edit-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> openEditModal(btn.dataset.id));
  });
}

// ── Quick Stats ──
function renderQuickStats(){
  const selectedMonth = $('monthFilter').value;
  const monthTx = transactions.filter(t=>monthKey(t.date)===selectedMonth && t.amount<0);
  if(!monthTx.length){
    $('qsBig').textContent='—'; $('qsAvg').textContent='—'; $('qsDays').textContent='—'; return;
  }
  const biggest = Math.max(...monthTx.map(t=>Math.abs(t.amount)));
  const bigEntry = monthTx.find(t=>Math.abs(t.amount)===biggest);
  $('qsBig').textContent = bigEntry ? `${fmt(-biggest)} (${bigEntry.desc.slice(0,14)})` : '—';
  const daysInMonth = new Date(selectedMonth.slice(0,4), parseInt(selectedMonth.slice(5))+1, 0).getDate();
  const today = new Date();
  const passedDays = (monthKey(today.toISOString().slice(0,10))===selectedMonth) ? today.getDate() : daysInMonth;
  const totalSpent = monthTx.reduce((s,t)=>s+Math.abs(t.amount),0);
  $('qsAvg').textContent = passedDays > 0 ? fmt(totalSpent/passedDays)+'/day' : '—';
  const lastDay = new Date(selectedMonth.slice(0,4), parseInt(selectedMonth.slice(5)), 0).getDate();
  const daysLeft = lastDay - today.getDate();
  $('qsDays').textContent = monthKey(today.toISOString().slice(0,10))===selectedMonth
    ? (daysLeft >= 0 ? daysLeft + ' days' : 'Last day') : '—';
}

// ── Top strip ──
function renderTopStrip(){
  const all = computeLedger();
  const totalBalance = all.length ? all[0].balance : 0;
  $('totalBalance').textContent = fmt(totalBalance);
  const selectedMonth = $('monthFilter').value;
  const monthTx = transactions.filter(t=>monthKey(t.date)===selectedMonth);
  const spent  = monthTx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
  const income = monthTx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  $('monthSpent').textContent  = fmt(spent);
  $('monthIncome').textContent = fmt(income);
  const net = income - spent;
  const netEl = $('monthNet');
  netEl.textContent = fmt(net);
  netEl.className = 'val mono ' + (net >= 0 ? 'pos' : 'neg');
}

// ── Breakdown chart ──
function renderBreakdown(){
  const selectedMonth = $('monthFilter').value;
  const monthTx = transactions.filter(t=>monthKey(t.date)===selectedMonth && t.amount<0);
  const totals = {};
  CATEGORIES.forEach(c=>totals[c]=0);
  monthTx.forEach(t=>{ totals[t.category]=(totals[t.category]||0)+Math.abs(t.amount); });
  const wrap=$('breakdown');
  const w=wrap.clientWidth>0?wrap.clientWidth:500;
  const rowH=34, padL=100,padR=70,padT=10,padB=10;
  const h=padT+padB+rowH*CATEGORIES.length;
  const plotW=w-padL-padR;
  const maxVal=Math.max(1,...CATEGORIES.map(c=>Math.max(totals[c]||0,budgets[c]||0)));
  let rows="";
  CATEGORIES.forEach((c,i)=>{
    const spent=totals[c]||0; const limit=budgets[c]||0;
    const y=padT+i*rowH; const barY=y+rowH*0.22; const barH=rowH*0.5;
    const barW=(spent/maxVal)*plotW; const over=limit>0&&spent>limit;
    const color=categoryColor(c);
    rows+=`<text x="0" y="${y+rowH*0.55}" font-size="12" fill="var(--charcoal)" font-family="Source Sans 3,sans-serif">${c}</text>`;
    rows+=`<rect x="${padL}" y="${barY}" width="${plotW}" height="${barH}" fill="none" stroke="var(--paper-line)"></rect>`;
    rows+=`<rect x="${padL}" y="${barY}" width="${Math.max(1,barW)}" height="${barH}" fill="${color}" ${over?'stroke="var(--rust)" stroke-width="2"':''}></rect>`;
    if(limit>0){ const tickX=padL+(limit/maxVal)*plotW; rows+=`<line x1="${tickX}" y1="${barY-4}" x2="${tickX}" y2="${barY+barH+4}" stroke="var(--rust)" stroke-width="1.5" stroke-dasharray="2,2"></line>`; }
    rows+=`<text x="${padL+plotW+8}" y="${y+rowH*0.55}" font-size="11" fill="var(--muted)" font-family="Space Mono,monospace">${fmt(-spent)}</text>`;
  });
  wrap.innerHTML=`<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
  const legend=$('breakdownLegend');
  if(legend) legend.innerHTML=CATEGORIES.map(c=>`<span><span class="swatch" style="background:${categoryColor(c)};"></span>${c}</span>`).join('')
    +`<span><span class="swatch" style="background:none;border:1.5px dashed var(--rust);width:8px;height:8px;"></span>Budget limit</span>`;
}

// ── Shared graph SVG builder ──
function buildBarLineSVG(wrap, buckets, labelFn, statsWrap, statsCards){
  const w = wrap.clientWidth > 0 ? wrap.clientWidth : 500;
  const h = 230;
  const padL = 46, padR = 14, padT = 16, padB = 28;
  const plotW = w - padL - padR, plotH = h - padT - padB;

  const allSorted = [...transactions].sort((a,b)=>a.date.localeCompare(b.date));
  let running = 0, sidx = 0;
  const balances = buckets.map(b => {
    while(sidx < allSorted.length && allSorted[sidx].date <= b.endKey){
      running += allSorted[sidx].amount; sidx++;
    }
    return running;
  });

  const maxBar = Math.max(1, ...buckets.map(b => Math.max(b.income, b.expense)));
  const minBal = Math.min(0, ...balances), maxBal = Math.max(1, ...balances);
  const balRange = (maxBal - minBal) || 1;
  const groupW = plotW / buckets.length;
  const barW = Math.max(2, Math.min(18, groupW * 0.3));
  const yBar = v => padT + plotH - (v / maxBar) * plotH;
  const yBal = v => padT + plotH - ((v - minBal) / balRange) * plotH;

  // Y-axis labels
  let yAxis = '';
  for(let i = 0; i <= 4; i++){
    const v = (maxBar / 4) * i;
    const y = yBar(v);
    const label = v >= 1000 ? '₹'+(v/1000).toFixed(0)+'k' : '₹'+v.toFixed(0);
    yAxis += `<text x="${padL-4}" y="${y+3}" text-anchor="end" font-size="9" fill="var(--muted)" font-family="Space Mono,monospace">${label}</text>`;
    yAxis += `<line x1="${padL}" y1="${y}" x2="${padL+plotW}" y2="${y}" stroke="var(--paper-line)" stroke-width="0.5"></line>`;
  }

  let bars = '', linePts = [];
  buckets.forEach((b, i) => {
    const cx = padL + groupW * i + groupW / 2;
    const incH = (b.income / maxBar) * plotH;
    const expH = (b.expense / maxBar) * plotH;
    if(incH > 0) bars += `<rect x="${cx-barW-1.5}" y="${yBar(b.income)}" width="${barW}" height="${incH}" fill="var(--sage)" rx="2" opacity="0.85"></rect>`;
    if(expH > 0) bars += `<rect x="${cx+1.5}" y="${yBar(b.expense)}" width="${barW}" height="${expH}" fill="var(--rust)" rx="2" opacity="0.85"></rect>`;
    const lbl = labelFn(b, i, buckets.length);
    if(lbl) bars += `<text x="${cx}" y="${h-8}" text-anchor="middle" font-size="9.5" fill="var(--muted)" font-family="Space Mono,monospace">${lbl}</text>`;
    linePts.push([cx, yBal(balances[i])]);
  });

  const linePath = linePts.map((p,i) => (i===0?'M':'L')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const areaPath = linePath + ` L${linePts[linePts.length-1][0].toFixed(1)} ${(padT+plotH).toFixed(1)} L${padL} ${(padT+plotH).toFixed(1)} Z`;
  const dots = linePts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="var(--brass)" stroke="var(--surface)" stroke-width="1.5"></circle>`).join('');
  const zeroY = yBal(0);
  const zeroLine = minBal < 0 ? `<line x1="${padL}" y1="${zeroY}" x2="${padL+plotW}" y2="${zeroY}" stroke="var(--rust)" stroke-dasharray="3,3" stroke-width="1" opacity="0.5"></line>` : '';

  wrap.innerHTML = `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="balAreaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--brass)" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="var(--brass)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${yAxis}${zeroLine}${bars}
    <path d="${areaPath}" fill="url(#balAreaGrad)"></path>
    <path d="${linePath}" fill="none" stroke="var(--brass)" stroke-width="2" stroke-linejoin="round"></path>
    ${dots}
  </svg>`;

  if(statsWrap && statsCards){
    const statCard = (label, value, cls='neutral') =>
      `<div class="graph-stats-item"><span class="graph-stats-label">${label}</span><span class="graph-stats-value ${cls}">${value}</span></div>`;
    statsWrap.innerHTML = statsCards.map(s => statCard(s.label, s.value, s.cls||'neutral')).join('');
  }
}

// ── Weekly Graph (last 8 weeks) ──
function renderGraphWeekly(){
  const wrap = $('graphSheetWeekly'), statsWrap = $('graphStatsWeekly');
  if(!wrap) return;
  const now = new Date();
  const buckets = [];
  for(let i = 7; i >= 0; i--){
    const end = new Date(now); end.setDate(now.getDate() - i*7);
    const start = new Date(end); start.setDate(end.getDate() - 6);
    const startStr = start.toISOString().slice(0,10);
    const endStr   = end.toISOString().slice(0,10);
    const tx = transactions.filter(t => t.date >= startStr && t.date <= endStr);
    const income  = tx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
    const expense = tx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
    // week label: "W1", "W2"… or day-range
    const d = new Date(end);
    const label = d.toLocaleString('default',{month:'short',day:'numeric'});
    buckets.push({ startStr, endStr, endKey: endStr, income, expense, label });
  }
  const totalInc = buckets.reduce((s,b)=>s+b.income,0);
  const totalExp = buckets.reduce((s,b)=>s+b.expense,0);
  const avgWeekExp = totalExp / 8;
  const savRate = totalInc > 0 ? ((totalInc-totalExp)/totalInc*100) : null;
  const statsCards = [
    { label:'8-wk income',  value: fmt(totalInc),     cls: 'pos'     },
    { label:'8-wk spent',   value: fmt(-totalExp),    cls: 'neg'     },
    { label:'Avg/week',     value: fmt(-avgWeekExp),  cls: 'neutral' },
    { label:'Savings rate', value: savRate!==null ? savRate.toFixed(1)+'%':'—', cls: savRate>=20?'pos':savRate>=0?'neutral':'neg' },
  ];
  buildBarLineSVG(wrap, buckets, (b,i,len) => {
    // show label every 2nd bucket or first/last
    return (i===0||i===len-1||i%2===0) ? b.label : '';
  }, statsWrap, statsCards);
}

// ── Monthly Graph (last 12 months) ──
function renderGraphMonthly(){
  const wrap = $('graphSheetMonthly'), statsWrap = $('graphStatsMonthly');
  if(!wrap) return;
  const now = new Date();
  const buckets = [];
  for(let i = 11; i >= 0; i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const m = d.toISOString().slice(0,7);
    const endKey = new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10);
    const tx = transactions.filter(t => monthKey(t.date) === m);
    const income  = tx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
    const expense = tx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
    buckets.push({ m, endKey, income, expense });
  }
  const totalInc = buckets.reduce((s,b)=>s+b.income,0);
  const totalExp = buckets.reduce((s,b)=>s+b.expense,0);
  const avgMonExp = totalExp / 12;
  const savRate = totalInc > 0 ? ((totalInc-totalExp)/totalInc*100) : null;
  const activeMonths = buckets.filter(b=>b.income>0||b.expense>0).length;
  const statsCards = [
    { label:'12-mo income', value: fmt(totalInc),     cls: 'pos'     },
    { label:'12-mo spent',  value: fmt(-totalExp),    cls: 'neg'     },
    { label:'Avg/month',    value: fmt(-avgMonExp),   cls: 'neutral' },
    { label:'Savings rate', value: savRate!==null ? savRate.toFixed(1)+'%':'—', cls: savRate>=20?'pos':savRate>=0?'neutral':'neg' },
  ];
  buildBarLineSVG(wrap, buckets, (b,i,len) => {
    const d = new Date(b.m+'-01T00:00:00');
    return (i===0||i===len-1||i%2===0) ? d.toLocaleString('default',{month:'short'}) : '';
  }, statsWrap, statsCards);
}

// ── Yearly Graph (last 5 years) ──
function renderGraphYearly(){
  const wrap = $('graphSheetYearly'), statsWrap = $('graphStatsYearly');
  if(!wrap) return;
  const now = new Date();
  const buckets = [];
  for(let i = 4; i >= 0; i--){
    const yr = now.getFullYear() - i;
    const startKey = `${yr}-01-01`, endKey = `${yr}-12-31`;
    const tx = transactions.filter(t => t.date >= startKey && t.date <= endKey);
    const income  = tx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
    const expense = tx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
    buckets.push({ yr, endKey, income, expense });
  }
  const totalInc = buckets.reduce((s,b)=>s+b.income,0);
  const totalExp = buckets.reduce((s,b)=>s+b.expense,0);
  const net = totalInc - totalExp;
  const savRate = totalInc > 0 ? (net/totalInc*100) : null;
  const statsCards = [
    { label:'5-yr income', value: fmt(totalInc),  cls: 'pos'     },
    { label:'5-yr spent',  value: fmt(-totalExp), cls: 'neg'     },
    { label:'5-yr net',    value: fmt(net),        cls: net>=0?'pos':'neg' },
    { label:'Overall save rate', value: savRate!==null ? savRate.toFixed(1)+'%':'—', cls: savRate>=20?'pos':savRate>=0?'neutral':'neg' },
  ];
  buildBarLineSVG(wrap, buckets, (b) => String(b.yr), statsWrap, statsCards);
}

// ── Tab switcher ──
let activeGraphTab = 'weekly';
function switchGraphTab(tab){
  activeGraphTab = tab;
  ['weekly','monthly','yearly'].forEach(t => {
    const btn = $('gtab' + t.charAt(0).toUpperCase() + t.slice(1));
    const panel = $('gpanel' + t.charAt(0).toUpperCase() + t.slice(1));
    if(btn)   btn.classList.toggle('active', t === tab);
    if(panel) panel.classList.toggle('hidden', t !== tab);
  });
  // Render on demand (wrap needs clientWidth, so render after panel is visible)
  requestAnimationFrame(() => {
    if(tab === 'weekly')  renderGraphWeekly();
    if(tab === 'monthly') renderGraphMonthly();
    if(tab === 'yearly')  renderGraphYearly();
  });
}

// Legacy alias so renderAll still works
function renderGraphSheet(){ renderGraphWeekly(); }

function renderAll(){
  populateMonthFilter();
  renderLedger();
  renderTopStrip();
  renderBreakdown();
  renderBudgetInputs();
  renderGraphWeekly();
  renderGraphMonthly();
  renderGraphYearly();
  renderGoals();
  renderRecurring();
  renderQuickStats();
}


// ═══════════════════════════════════════════════════════
//  SAMPLE DATA IMPORT
// ═══════════════════════════════════════════════════════

const DEMO_DATA = {"transactions": [{"id": "demo_1", "date": "2024-01-01", "amount": 75000, "category": "Other", "type": "income", "desc": "Monthly Salary - January", "note": ""}, {"id": "demo_2", "date": "2024-01-03", "amount": -3500, "category": "Food", "type": "expense", "desc": "Groceries at Big Bazaar", "note": ""}, {"id": "demo_3", "date": "2024-01-05", "amount": -1200, "category": "Transport", "type": "expense", "desc": "Fuel for bike", "note": ""}, {"id": "demo_4", "date": "2024-01-05", "amount": -15000, "category": "Housing", "type": "expense", "desc": "Monthly Rent - January", "note": ""}, {"id": "demo_5", "date": "2024-01-07", "amount": -1800, "category": "Utilities", "type": "expense", "desc": "Electricity Bill", "note": ""}, {"id": "demo_6", "date": "2024-01-10", "amount": -4500, "category": "Food", "type": "expense", "desc": "Restaurant dinner with friends", "note": ""}, {"id": "demo_7", "date": "2024-01-12", "amount": -2500, "category": "Entertainment", "type": "expense", "desc": "Movie tickets & popcorn", "note": ""}, {"id": "demo_8", "date": "2024-01-15", "amount": -5000, "category": "Shopping", "type": "expense", "desc": "Clothes shopping - T-shirts & jeans", "note": ""}, {"id": "demo_9", "date": "2024-01-18", "amount": -1500, "category": "Health", "type": "expense", "desc": "Gym membership", "note": ""}, {"id": "demo_10", "date": "2024-01-22", "amount": -3200, "category": "Food", "type": "expense", "desc": "Weekly groceries", "note": ""}, {"id": "demo_11", "date": "2024-01-25", "amount": -1500, "category": "Transport", "type": "expense", "desc": "Auto fare + fuel", "note": ""}, {"id": "demo_12", "date": "2024-01-28", "amount": -2000, "category": "Entertainment", "type": "expense", "desc": "Gaming purchase", "note": ""}, {"id": "demo_13", "date": "2024-02-01", "amount": 75000, "category": "Other", "type": "income", "desc": "Monthly Salary - February", "note": ""}, {"id": "demo_14", "date": "2024-02-02", "amount": 12500, "category": "Other", "type": "income", "desc": "Freelance web design project", "note": ""}, {"id": "demo_15", "date": "2024-02-05", "amount": -3800, "category": "Food", "type": "expense", "desc": "Groceries & vegetables market", "note": ""}, {"id": "demo_16", "date": "2024-02-08", "amount": -15000, "category": "Housing", "type": "expense", "desc": "Monthly Rent - February", "note": ""}, {"id": "demo_17", "date": "2024-02-10", "amount": -1500, "category": "Transport", "type": "expense", "desc": "Bus pass & auto fare", "note": ""}, {"id": "demo_18", "date": "2024-02-12", "amount": -2500, "category": "Utilities", "type": "expense", "desc": "Water bill + internet", "note": ""}, {"id": "demo_19", "date": "2024-02-15", "amount": -3500, "category": "Food", "type": "expense", "desc": "Groceries shopping", "note": ""}, {"id": "demo_20", "date": "2024-02-18", "amount": -4500, "category": "Shopping", "type": "expense", "desc": "Shoes & accessories", "note": ""}, {"id": "demo_21", "date": "2024-02-20", "amount": -1200, "category": "Health", "type": "expense", "desc": "Medicine & doctor visit", "note": ""}, {"id": "demo_22", "date": "2024-02-22", "amount": -3000, "category": "Entertainment", "type": "expense", "desc": "Concert tickets", "note": ""}, {"id": "demo_23", "date": "2024-02-25", "amount": -1800, "category": "Transport", "type": "expense", "desc": "Fuel for weekly commute", "note": ""}, {"id": "demo_24", "date": "2024-03-01", "amount": 75000, "category": "Other", "type": "income", "desc": "Monthly Salary - March", "note": ""}, {"id": "demo_25", "date": "2024-03-05", "amount": -4200, "category": "Food", "type": "expense", "desc": "Groceries at Reliance Fresh", "note": ""}, {"id": "demo_26", "date": "2024-03-08", "amount": -15000, "category": "Housing", "type": "expense", "desc": "Monthly Rent - March", "note": ""}, {"id": "demo_27", "date": "2024-03-10", "amount": -2000, "category": "Transport", "type": "expense", "desc": "Fuel & auto fare", "note": ""}, {"id": "demo_28", "date": "2024-03-12", "amount": -1700, "category": "Utilities", "type": "expense", "desc": "Electricity bill", "note": ""}, {"id": "demo_29", "date": "2024-03-15", "amount": -3500, "category": "Food", "type": "expense", "desc": "Weekly groceries", "note": ""}, {"id": "demo_30", "date": "2024-03-18", "amount": -6500, "category": "Shopping", "type": "expense", "desc": "Summer clothes shopping", "note": ""}, {"id": "demo_31", "date": "2024-03-20", "amount": -2000, "category": "Entertainment", "type": "expense", "desc": "Sports match tickets", "note": ""}, {"id": "demo_32", "date": "2024-03-22", "amount": -1500, "category": "Health", "type": "expense", "desc": "Dental checkup", "note": ""}, {"id": "demo_33", "date": "2024-03-25", "amount": -2500, "category": "Food", "type": "expense", "desc": "Groceries & food items", "note": ""}, {"id": "demo_34", "date": "2024-04-01", "amount": 75000, "category": "Other", "type": "income", "desc": "Monthly Salary - April", "note": ""}, {"id": "demo_35", "date": "2024-04-05", "amount": -3000, "category": "Food", "type": "expense", "desc": "Groceries shopping", "note": ""}, {"id": "demo_36", "date": "2024-04-08", "amount": -15000, "category": "Housing", "type": "expense", "desc": "Monthly Rent - April", "note": ""}, {"id": "demo_37", "date": "2024-04-10", "amount": -1800, "category": "Transport", "type": "expense", "desc": "Fuel & transport", "note": ""}, {"id": "demo_38", "date": "2024-04-12", "amount": -2500, "category": "Utilities", "type": "expense", "desc": "Water & electricity", "note": ""}, {"id": "demo_39", "date": "2024-04-15", "amount": -4000, "category": "Food", "type": "expense", "desc": "Groceries at nearby store", "note": ""}, {"id": "demo_40", "date": "2024-04-18", "amount": -5500, "category": "Shopping", "type": "expense", "desc": "Online shopping - gadgets", "note": ""}, {"id": "demo_41", "date": "2024-04-20", "amount": -3500, "category": "Entertainment", "type": "expense", "desc": "Movie & dining out", "note": ""}, {"id": "demo_42", "date": "2024-04-22", "amount": -1200, "category": "Health", "type": "expense", "desc": "Health checkup", "note": ""}, {"id": "demo_43", "date": "2024-04-25", "amount": -2800, "category": "Food", "type": "expense", "desc": "Weekly groceries", "note": ""}, {"id": "demo_44", "date": "2024-05-01", "amount": 75000, "category": "Other", "type": "income", "desc": "Monthly Salary - May", "note": ""}, {"id": "demo_45", "date": "2024-05-05", "amount": -4500, "category": "Food", "type": "expense", "desc": "Groceries & household items", "note": ""}, {"id": "demo_46", "date": "2024-05-08", "amount": -15000, "category": "Housing", "type": "expense", "desc": "Monthly Rent - May", "note": ""}, {"id": "demo_47", "date": "2024-05-10", "amount": -2200, "category": "Transport", "type": "expense", "desc": "Fuel & public transport", "note": ""}, {"id": "demo_48", "date": "2024-05-12", "amount": -2000, "category": "Utilities", "type": "expense", "desc": "Electricity + water bill", "note": ""}, {"id": "demo_49", "date": "2024-05-15", "amount": -3800, "category": "Food", "type": "expense", "desc": "Groceries shopping", "note": ""}, {"id": "demo_50", "date": "2024-05-18", "amount": -4200, "category": "Shopping", "type": "expense", "desc": "Clothing & accessories", "note": ""}, {"id": "demo_51", "date": "2024-05-20", "amount": -2500, "category": "Entertainment", "type": "expense", "desc": "Cafe & entertainment", "note": ""}, {"id": "demo_52", "date": "2024-05-22", "amount": -1600, "category": "Health", "type": "expense", "desc": "Pharmacy - medicines", "note": ""}, {"id": "demo_53", "date": "2024-05-25", "amount": -3200, "category": "Food", "type": "expense", "desc": "Weekly groceries", "note": ""}, {"id": "demo_54", "date": "2024-06-01", "amount": 75000, "category": "Other", "type": "income", "desc": "Monthly Salary - June", "note": ""}, {"id": "demo_55", "date": "2024-06-05", "amount": -5200, "category": "Food", "type": "expense", "desc": "Groceries at hypermarket", "note": ""}, {"id": "demo_56", "date": "2024-06-08", "amount": -15000, "category": "Housing", "type": "expense", "desc": "Monthly Rent - June", "note": ""}, {"id": "demo_57", "date": "2024-06-10", "amount": -2500, "category": "Transport", "type": "expense", "desc": "Fuel & auto expenses", "note": ""}, {"id": "demo_58", "date": "2024-06-12", "amount": -3000, "category": "Utilities", "type": "expense", "desc": "High electricity bill (AC usage)", "note": ""}, {"id": "demo_59", "date": "2024-06-15", "amount": -4500, "category": "Food", "type": "expense", "desc": "Groceries & provisions", "note": ""}, {"id": "demo_60", "date": "2024-06-18", "amount": -7500, "category": "Shopping", "type": "expense", "desc": "Summer clothing haul", "note": ""}, {"id": "demo_61", "date": "2024-06-20", "amount": -4000, "category": "Entertainment", "type": "expense", "desc": "Vacation planning expenses", "note": ""}, {"id": "demo_62", "date": "2024-06-22", "amount": -2000, "category": "Health", "type": "expense", "desc": "Health & wellness", "note": ""}, {"id": "demo_63", "date": "2024-06-25", "amount": -3500, "category": "Food", "type": "expense", "desc": "Weekly groceries", "note": ""}, {"id": "demo_64", "date": "2024-06-28", "amount": 8000, "category": "Other", "type": "income", "desc": "Bonus from freelance work", "note": ""}, {"id": "demo_65", "date": "2024-07-01", "amount": 75000, "category": "Other", "type": "income", "desc": "Monthly Salary - July", "note": ""}, {"id": "demo_66", "date": "2024-07-05", "amount": -3800, "category": "Food", "type": "expense", "desc": "Groceries shopping", "note": ""}, {"id": "demo_67", "date": "2024-07-08", "amount": -15000, "category": "Housing", "type": "expense", "desc": "Monthly Rent - July", "note": ""}, {"id": "demo_68", "date": "2024-07-10", "amount": -1900, "category": "Transport", "type": "expense", "desc": "Fuel & transport", "note": ""}, {"id": "demo_69", "date": "2024-07-12", "amount": -2200, "category": "Utilities", "type": "expense", "desc": "Utilities bill", "note": ""}, {"id": "demo_70", "date": "2024-07-15", "amount": -4200, "category": "Food", "type": "expense", "desc": "Groceries provisions", "note": ""}, {"id": "demo_71", "date": "2024-07-18", "amount": -5800, "category": "Shopping", "type": "expense", "desc": "Tech gadgets shopping", "note": ""}, {"id": "demo_72", "date": "2024-07-20", "amount": -2800, "category": "Entertainment", "type": "expense", "desc": "Movies & dining", "note": ""}, {"id": "demo_73", "date": "2024-07-22", "amount": -1500, "category": "Health", "type": "expense", "desc": "Pharmacy visit", "note": ""}, {"id": "demo_74", "date": "2024-07-25", "amount": -3000, "category": "Food", "type": "expense", "desc": "Weekly groceries", "note": ""}, {"id": "demo_75", "date": "2024-08-01", "amount": 75000, "category": "Other", "type": "income", "desc": "Monthly Salary - August", "note": ""}, {"id": "demo_76", "date": "2024-08-05", "amount": -4000, "category": "Food", "type": "expense", "desc": "Groceries at local market", "note": ""}, {"id": "demo_77", "date": "2024-08-08", "amount": -15000, "category": "Housing", "type": "expense", "desc": "Monthly Rent - August", "note": ""}, {"id": "demo_78", "date": "2024-08-10", "amount": -2100, "category": "Transport", "type": "expense", "desc": "Fuel & commute", "note": ""}, {"id": "demo_79", "date": "2024-08-12", "amount": -1800, "category": "Utilities", "type": "expense", "desc": "Electricity bill", "note": ""}, {"id": "demo_80", "date": "2024-08-15", "amount": -3600, "category": "Food", "type": "expense", "desc": "Groceries shopping", "note": ""}, {"id": "demo_81", "date": "2024-08-18", "amount": -3500, "category": "Shopping", "type": "expense", "desc": "Shopping for home items", "note": ""}, {"id": "demo_82", "date": "2024-08-20", "amount": -3000, "category": "Entertainment", "type": "expense", "desc": "Family outing & meals", "note": ""}, {"id": "demo_83", "date": "2024-08-22", "amount": -1400, "category": "Health", "type": "expense", "desc": "Health supplements", "note": ""}, {"id": "demo_84", "date": "2024-08-25", "amount": -2900, "category": "Food", "type": "expense", "desc": "Weekly groceries", "note": ""}, {"id": "demo_85", "date": "2024-09-01", "amount": 75000, "category": "Other", "type": "income", "desc": "Monthly Salary - September", "note": ""}, {"id": "demo_86", "date": "2024-09-05", "amount": -3700, "category": "Food", "type": "expense", "desc": "Groceries at supermarket", "note": ""}, {"id": "demo_87", "date": "2024-09-08", "amount": -15000, "category": "Housing", "type": "expense", "desc": "Monthly Rent - September", "note": ""}, {"id": "demo_88", "date": "2024-09-10", "amount": -2000, "category": "Transport", "type": "expense", "desc": "Fuel & transport costs", "note": ""}, {"id": "demo_89", "date": "2024-09-12", "amount": -1900, "category": "Utilities", "type": "expense", "desc": "Utilities & bills", "note": ""}, {"id": "demo_90", "date": "2024-09-15", "amount": -4100, "category": "Food", "type": "expense", "desc": "Groceries & provisions", "note": ""}, {"id": "demo_91", "date": "2024-09-18", "amount": -4800, "category": "Shopping", "type": "expense", "desc": "School shopping for family", "note": ""}, {"id": "demo_92", "date": "2024-09-20", "amount": -2500, "category": "Entertainment", "type": "expense", "desc": "Entertainment expenses", "note": ""}, {"id": "demo_93", "date": "2024-09-22", "amount": -1300, "category": "Health", "type": "expense", "desc": "Medical visit & medicines", "note": ""}, {"id": "demo_94", "date": "2024-09-25", "amount": -3100, "category": "Food", "type": "expense", "desc": "Weekly groceries", "note": ""}, {"id": "demo_95", "date": "2024-10-01", "amount": 75000, "category": "Other", "type": "income", "desc": "Monthly Salary - October", "note": ""}, {"id": "demo_96", "date": "2024-10-05", "amount": -3900, "category": "Food", "type": "expense", "desc": "Groceries shopping", "note": ""}, {"id": "demo_97", "date": "2024-10-08", "amount": -15000, "category": "Housing", "type": "expense", "desc": "Monthly Rent - October", "note": ""}, {"id": "demo_98", "date": "2024-10-10", "amount": -2300, "category": "Transport", "type": "expense", "desc": "Fuel & transport", "note": ""}, {"id": "demo_99", "date": "2024-10-12", "amount": -2600, "category": "Utilities", "type": "expense", "desc": "Diwali electricity bills", "note": ""}, {"id": "demo_100", "date": "2024-10-15", "amount": -5500, "category": "Food", "type": "expense", "desc": "Diwali groceries & sweets", "note": ""}, {"id": "demo_101", "date": "2024-10-18", "amount": -8500, "category": "Shopping", "type": "expense", "desc": "Diwali shopping - gifts & decor", "note": ""}, {"id": "demo_102", "date": "2024-10-20", "amount": -4500, "category": "Entertainment", "type": "expense", "desc": "Diwali celebrations", "note": ""}, {"id": "demo_103", "date": "2024-10-22", "amount": -2200, "category": "Health", "type": "expense", "desc": "Health checkup", "note": ""}, {"id": "demo_104", "date": "2024-10-25", "amount": -3500, "category": "Food", "type": "expense", "desc": "Weekly groceries", "note": ""}, {"id": "demo_105", "date": "2024-10-30", "amount": 10000, "category": "Other", "type": "income", "desc": "Diwali bonus from employer", "note": ""}, {"id": "demo_106", "date": "2024-11-01", "amount": 75000, "category": "Other", "type": "income", "desc": "Monthly Salary - November", "note": ""}, {"id": "demo_107", "date": "2024-11-05", "amount": -3600, "category": "Food", "type": "expense", "desc": "Groceries shopping", "note": ""}, {"id": "demo_108", "date": "2024-11-08", "amount": -15000, "category": "Housing", "type": "expense", "desc": "Monthly Rent - November", "note": ""}, {"id": "demo_109", "date": "2024-11-10", "amount": -2200, "category": "Transport", "type": "expense", "desc": "Fuel & transport", "note": ""}, {"id": "demo_110", "date": "2024-11-12", "amount": -1800, "category": "Utilities", "type": "expense", "desc": "Electricity bill", "note": ""}, {"id": "demo_111", "date": "2024-11-15", "amount": -4000, "category": "Food", "type": "expense", "desc": "Groceries & food items", "note": ""}, {"id": "demo_112", "date": "2024-11-18", "amount": -3200, "category": "Shopping", "type": "expense", "desc": "Shopping for winter clothes", "note": ""}, {"id": "demo_113", "date": "2024-11-20", "amount": -2000, "category": "Entertainment", "type": "expense", "desc": "Entertainment & leisure", "note": ""}, {"id": "demo_114", "date": "2024-11-22", "amount": -1100, "category": "Health", "type": "expense", "desc": "Health & wellness", "note": ""}, {"id": "demo_115", "date": "2024-11-25", "amount": -3200, "category": "Food", "type": "expense", "desc": "Weekly groceries", "note": ""}, {"id": "demo_116", "date": "2024-12-01", "amount": 75000, "category": "Other", "type": "income", "desc": "Monthly Salary - December", "note": ""}, {"id": "demo_117", "date": "2024-12-05", "amount": -5500, "category": "Food", "type": "expense", "desc": "Year-end groceries shopping", "note": ""}, {"id": "demo_118", "date": "2024-12-08", "amount": -15000, "category": "Housing", "type": "expense", "desc": "Monthly Rent - December", "note": ""}, {"id": "demo_119", "date": "2024-12-10", "amount": -2500, "category": "Transport", "type": "expense", "desc": "Fuel & year-end travel", "note": ""}, {"id": "demo_120", "date": "2024-12-12", "amount": -3000, "category": "Utilities", "type": "expense", "desc": "High December electricity", "note": ""}, {"id": "demo_121", "date": "2024-12-15", "amount": -6000, "category": "Food", "type": "expense", "desc": "Holiday season groceries & party food", "note": ""}, {"id": "demo_122", "date": "2024-12-18", "amount": -9500, "category": "Shopping", "type": "expense", "desc": "Christmas shopping & gifts", "note": ""}, {"id": "demo_123", "date": "2024-12-20", "amount": -5500, "category": "Entertainment", "type": "expense", "desc": "Year-end celebrations", "note": ""}, {"id": "demo_124", "date": "2024-12-22", "amount": -2000, "category": "Health", "type": "expense", "desc": "Year-end health checkup", "note": ""}, {"id": "demo_125", "date": "2024-12-25", "amount": -4000, "category": "Food", "type": "expense", "desc": "Holiday meals & groceries", "note": ""}, {"id": "demo_126", "date": "2024-12-31", "amount": 15000, "category": "Other", "type": "income", "desc": "Year-end bonus", "note": ""}], "budgets": {"Food": 20000, "Transport": 8000, "Housing": 15000, "Utilities": 2500, "Entertainment": 10000, "Shopping": 15000, "Health": 5000, "Other": 5000}};

function importDemoData(){
  if(!currentUserId){
    showToast('Sign in first, then import.', 'error');
    return;
  }
  const existing = transactions.length;
  if(existing > 0){
    if(!confirm(`You already have ${existing} entries. Import will ADD the 126 sample entries alongside them. Continue?`)) return;
  }

  // Merge: avoid duplicate ids
  const existingIds = new Set(transactions.map(t=>t.id));
  let added = 0;
  DEMO_DATA.transactions.forEach(t => {
    if(!existingIds.has(t.id)){
      transactions.push(t);
      added++;
    }
  });

  // Merge budgets (only set where not already set)
  Object.entries(DEMO_DATA.budgets).forEach(([cat, val]) => {
    if(!budgets[cat] || budgets[cat] === 0) budgets[cat] = val;
  });

  saveTransactions();
  saveBudgets();
  renderAll();
  closeDemoModal();
  showToast(`Loaded ${added} sample entries for 2024 ✓`, 'success');
}

function openDemoModal(){
  $('demoImportOverlay').classList.add('active');
}
function closeDemoModal(){
  $('demoImportOverlay').classList.remove('active');
}

// ── Edit Modal ──
function openEditModal(id){
  const t = transactions.find(tx=>tx.id===id);
  if(!t) return;
  $('editId').value   = t.id;
  $('editDesc').value = t.desc;
  $('editAmt').value  = Math.abs(t.amount);
  $('editDate').value = t.date;
  $('editNote').value = t.note||'';
  // set category select
  const sel = $('editCat');
  for(let o of sel.options) o.selected = o.value===t.category;
  $('editModal').classList.add('open');
}
$('editCancelBtn').addEventListener('click',()=>$('editModal').classList.remove('open'));
$('editModal').addEventListener('click',e=>{ if(e.target===$('editModal')) $('editModal').classList.remove('open'); });
$('editSaveBtn').addEventListener('click', async ()=>{
  const id = $('editId').value;
  const idx = transactions.findIndex(t=>t.id===id);
  if(idx<0) return;
  const orig = transactions[idx];
  const amt = parseFloat($('editAmt').value)||0;
  transactions[idx] = {
    ...orig,
    desc: $('editDesc').value.trim()||orig.desc,
    amount: orig.amount<0 ? -Math.abs(amt) : Math.abs(amt),
    category: $('editCat').value,
    note: $('editNote').value.trim(),
    date: $('editDate').value||orig.date,
  };
  await saveTransactions();
  $('editModal').classList.remove('open');
  renderAll();
  showToast('Entry updated ✓', 'success');
});

// ── Savings Goals ──
async function loadGoals(){ try{ const g=localStorage.getItem(userKey('goals')); goals=g?JSON.parse(g):[]; }catch(e){ goals=[]; } }
async function saveGoals(){ try{ localStorage.setItem(userKey('goals'),JSON.stringify(goals)); }catch(e){} }

function renderGoals(){
  const wrap=$('goalsList'); wrap.innerHTML='';
  if(!goals.length){ wrap.innerHTML='<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">No goals yet — add one below.</div>'; return; }
  goals.forEach((g,i)=>{
    const pct=Math.min(100,g.target>0?(g.saved/g.target)*100:0);
    const done=g.saved>=g.target&&g.target>0;
    const div=document.createElement('div'); div.className='goal-item';
    div.innerHTML=`
      <div class="goal-header">
        <span class="goal-name">${g.name}</span>
        ${done?'<span class="goal-done-badge">✓ Reached</span>':''}
        <span class="goal-amounts">${fmt(g.saved)} / ${fmt(g.target)}</span>
        <button class="goal-del-btn" data-idx="${i}" title="Delete">✕</button>
      </div>
      <div class="goal-track"><div class="goal-fill ${done?'done':''}" style="width:${pct}%"></div></div>
      ${!done?`<div class="goal-actions">
        <input type="number" class="goal-deposit-input" placeholder="Deposit ₹" min="0.01" step="0.01" data-idx="${i}">
        <button class="goal-deposit-btn" data-idx="${i}">Save</button>
      </div>`:''}
    `;
    wrap.appendChild(div);
  });
  wrap.querySelectorAll('.goal-del-btn').forEach(btn=>{ btn.addEventListener('click', async ()=>{ goals.splice(parseInt(btn.dataset.idx),1); await saveGoals(); renderGoals(); }); });
  wrap.querySelectorAll('.goal-deposit-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const idx=parseInt(btn.dataset.idx);
      const inp=wrap.querySelector(`.goal-deposit-input[data-idx="${idx}"]`);
      const amt=parseFloat(inp.value);
      if(!amt||amt<=0){ inp.focus(); return; }
      goals[idx].saved=Math.round((goals[idx].saved+amt)*100)/100;
      await saveGoals(); inp.value=''; renderGoals();
      showToast('Deposit saved ✓', 'success');
    });
  });
}

$('addGoalBtn').addEventListener('click', async ()=>{
  const name=$('goalName').value.trim(); const target=parseFloat($('goalTarget').value);
  if(!name){ $('goalName').focus(); return; }
  if(!target||target<=0){ $('goalTarget').focus(); return; }
  goals.push({name,target,saved:0}); await saveGoals();
  $('goalName').value=''; $('goalTarget').value=''; renderGoals();
  showToast('Goal added ✓', 'success');
});

// ── Recurring Transactions ──
async function loadRecurring(){ try{ const r=localStorage.getItem(userKey('recurring')); recurringItems=r?JSON.parse(r):[]; }catch(e){ recurringItems=[]; } }
async function saveRecurring(){ try{ localStorage.setItem(userKey('recurring'),JSON.stringify(recurringItems)); }catch(e){} }

function renderRecurring(){
  const wrap=$('recurList'); wrap.innerHTML='';
  if(!recurringItems.length){ wrap.innerHTML='<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">No recurring items yet.</div>'; return; }
  recurringItems.forEach((r,i)=>{
    const div=document.createElement('div'); div.className='recur-item';
    const freqLabel = {monthly:'Monthly',weekly:'Weekly',yearly:'Yearly'}[r.freq]||r.freq;
    div.innerHTML=`
      <div class="recur-info">
        <div class="recur-name">${r.name}</div>
        <div class="recur-meta">${freqLabel} · ${r.category}</div>
      </div>
      <div class="recur-amt ${r.type}">${r.type==='expense'?'-':'+'} ${fmt(r.amount)}</div>
      <button class="btn" style="margin-top:0;padding:6px 10px;font-size:11px;width:auto;" data-idx="${i}" title="Post now">Post</button>
      <button class="recur-del" data-idx="${i}" title="Delete">✕</button>
    `;
    wrap.appendChild(div);
  });
  wrap.querySelectorAll('[title="Post now"]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const r=recurringItems[parseInt(btn.dataset.idx)];
      const entry={
        id: Date.now()+Math.random().toString(16).slice(2),
        date: new Date().toISOString().slice(0,10),
        desc: r.name + ' (recurring)',
        category: r.category,
        note: `${r.freq} recurring`,
        amount: r.type==='income'?Math.abs(r.amount):-Math.abs(r.amount)
      };
      transactions.push(entry); await saveTransactions(); renderAll();
      showToast(r.name + ' posted ✓', 'success');
    });
  });
  wrap.querySelectorAll('.recur-del').forEach(btn=>{
    btn.addEventListener('click', async ()=>{ recurringItems.splice(parseInt(btn.dataset.idx),1); await saveRecurring(); renderRecurring(); });
  });
}

$('addRecurBtn').addEventListener('click', async ()=>{
  const name=$('recurName').value.trim(); const amt=parseFloat($('recurAmt').value);
  if(!name){ $('recurName').focus(); return; }
  if(!amt||amt<=0){ $('recurAmt').focus(); return; }
  recurringItems.push({ name, amount:amt, category:$('recurCat').value, freq:$('recurFreq').value, type:$('recurType').value });
  await saveRecurring(); $('recurName').value=''; $('recurAmt').value=''; renderRecurring();
  showToast('Recurring item added ✓', 'success');
});

// ── Search ──
if($('searchInput')) $('searchInput').addEventListener('input', renderLedger);

// ── Month filter ──
$('monthFilter').addEventListener('change', ()=>{ renderLedger(); renderTopStrip(); renderBreakdown(); renderQuickStats(); });

// ── Share / Export / Print / Clear ──
function buildShareText(){
  const selectedMonth=$('monthFilter').value;
  const d=new Date(selectedMonth+"-01T00:00:00");
  const monthLabel=d.toLocaleString('default',{month:'long',year:'numeric'});
  const monthTx=transactions.filter(t=>monthKey(t.date)===selectedMonth).sort((a,b)=>a.date.localeCompare(b.date));
  const spent=monthTx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
  const income=monthTx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const lines=[`TALLY — ${monthLabel}`,`Income: ${fmt(income)}   Spent: ${fmt(spent)}`,''];
  if(!monthTx.length) lines.push('No entries this month.');
  else monthTx.forEach(t=>{ const sign=t.amount<0?'-':'+'; lines.push(`${t.date}  ${t.desc} (${t.category})  ${sign}${fmt(Math.abs(t.amount))}`); });
  return lines.join('\n');
}

function closeMenu(){ $('menuDropdown').classList.remove('open'); $('menuBtn').setAttribute('aria-expanded','false'); }
function toggleMenu(e){ e.stopPropagation(); const open=$('menuDropdown').classList.toggle('open'); $('menuBtn').setAttribute('aria-expanded',open?'true':'false'); }
$('menuBtn').addEventListener('click',toggleMenu);

$('shareBtn').addEventListener('click', async ()=>{
  const text=buildShareText(); const selectedMonth=$('monthFilter').value;
  const d=new Date(selectedMonth+"-01T00:00:00"); const title=`Tally — ${d.toLocaleString('default',{month:'long',year:'numeric'})}`;
  if(navigator.share){ try{ await navigator.share({title,text}); }catch(e){} }
  else if(navigator.clipboard){ try{ await navigator.clipboard.writeText(text); showToast('Ledger copied to clipboard'); }catch(e){ alert(text); } }
  else { alert(text); }
  closeMenu();
});

$('exportCsvBtn').addEventListener('click', ()=>{
  const selectedMonth=$('monthFilter').value;
  const monthTx=transactions.filter(t=>monthKey(t.date)===selectedMonth).sort((a,b)=>a.date.localeCompare(b.date));
  const rows=[['Date','Description','Note','Category','Amount (₹)','Type']];
  monthTx.forEach(t=>rows.push([t.date,'"'+t.desc.replace(/"/g,'""')+'"','"'+(t.note||'').replace(/"/g,'""')+'"',t.category,Math.abs(t.amount).toFixed(2),t.amount>=0?'Income':'Expense']));
  const csv=rows.map(r=>r.join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=`tally-${selectedMonth}.csv`; a.click(); URL.revokeObjectURL(url);
  closeMenu(); showToast('CSV exported ✓', 'success');
});

$('copySummaryBtn').addEventListener('click', ()=>{
  const selectedMonth=$('monthFilter').value;
  const d=new Date(selectedMonth+'-01T00:00:00');
  const label=d.toLocaleString('default',{month:'long',year:'numeric'});
  const monthTx=transactions.filter(t=>monthKey(t.date)===selectedMonth);
  const income=monthTx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const spent=monthTx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
  const net=income-spent;
  const savingsPct=income>0?((income-spent)/income*100).toFixed(1):'—';
  const catTotals={}; CATEGORIES.forEach(c=>catTotals[c]=0);
  monthTx.filter(t=>t.amount<0).forEach(t=>{ catTotals[t.category]=(catTotals[t.category]||0)+Math.abs(t.amount); });
  const catLines=CATEGORIES.filter(c=>catTotals[c]>0).map(c=>`  ${c.padEnd(16,' ')}${fmt(catTotals[c])}`);
  const summary=[`📊 TALLY — ${label}`,`Income  : ${fmt(income)}`,`Spent   : ${fmt(spent)}`,`Net     : ${fmt(net)}`,`Savings : ${savingsPct}%`,catLines.length?`\nBy category:\n${catLines.join('\n')}`:''  ].filter(Boolean).join('\n');
  navigator.clipboard.writeText(summary).then(()=>showToast('Summary copied ✓')).catch(()=>alert(summary));
  closeMenu();
});

$('printBtn').addEventListener('click',()=>{ closeMenu(); window.print(); });

$('clearMonthBtn').addEventListener('click', async ()=>{
  const selectedMonth=$('monthFilter').value;
  const d=new Date(selectedMonth+'-01T00:00:00');
  const label=d.toLocaleString('default',{month:'long',year:'numeric'});
  if(!confirm(`Delete all entries for ${label}? This cannot be undone.`)) return;
  transactions=transactions.filter(t=>monthKey(t.date)!==selectedMonth);
  await saveTransactions(); closeMenu(); renderAll();
  showToast('Month cleared', 'error');
});

document.addEventListener('click', e=>{
  const dropdown=$('menuDropdown');
  if(dropdown.classList.contains('open')&&!dropdown.contains(e.target)&&e.target!==$('menuBtn')) closeMenu();
});

// ── Auth ──
async function getStoredHash(uid){ try{ return localStorage.getItem(`tally:user:${uid}:passhash`); }catch(e){ return null; } }
async function setStoredHash(uid,hash){ try{ localStorage.setItem(`tally:user:${uid}:passhash`,hash); }catch(e){} }
async function clearUserData(uid){
  ['passhash','transactions','budgets','profile','goals','recurring'].forEach(k=>{ try{ localStorage.removeItem(`tally:user:${uid}:${k}`); }catch(e){} });
}
async function setUserProfile(uid,profile){ try{ localStorage.setItem(`tally:user:${uid}:profile`,JSON.stringify(profile)); }catch(e){} }
async function getUserProfile(uid){ try{ const p=localStorage.getItem(`tally:user:${uid}:profile`); return p?JSON.parse(p):{}; }catch(e){ return {}; } }

function renderProfileStrip(profile){
  const strip=$('profileStrip'), avatarEl=$('profileAvatar'), nameEl=$('profileName'),
        idEl=$('headerUserTag'), emailEl=$('profileEmail'), phoneEl=$('profilePhone'),
        sepEmailEl=$('profileSepEmail'), sepPhoneEl=$('profileSepPhone');
  const name=(profile&&profile.name)||''; const email=(profile&&profile.email)||''; const phone=(profile&&profile.phone)||'';
  strip.classList.remove('hidden-strip');
  if(name){ const parts=name.trim().split(/\s+/); avatarEl.textContent=parts.length>=2?(parts[0][0]+parts[parts.length-1][0]).toUpperCase():parts[0].slice(0,2).toUpperCase(); }
  else { avatarEl.textContent=currentUserId?currentUserId[0].toUpperCase():'?'; }
  nameEl.textContent=name||currentUserId||'—';
  idEl.textContent=currentUserId?`@${currentUserId}`:'';
  emailEl.textContent=email; phoneEl.textContent=phone;
  if(sepEmailEl) sepEmailEl.classList.toggle('hidden',!email);
  if(sepPhoneEl) sepPhoneEl.classList.toggle('hidden',!(email&&phone)&&!(!email&&phone));
}

function updateHeaderGreeting(userName){
  const now = new Date();
  const h = now.getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night';
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const el = id => document.getElementById(id);
  if(userName !== undefined) window._greetingUser = userName;
  const user = (window._greetingUser !== undefined) ? window._greetingUser : (window.currentUserId || '');
  if(el('headerGreetingName')) el('headerGreetingName').textContent = greeting + (user ? ', ' + user.split(' ')[0] + '.' : '.');
  if(el('headerGreetingLine')) el('headerGreetingLine').textContent = 'Your household ledger · ' + dayNames[now.getDay()];
  if(el('headerGreetingMonth')) el('headerGreetingMonth').textContent = monthNames[now.getMonth()] + ' ' + now.getFullYear();
  if(el('headerDateDay')) el('headerDateDay').textContent = now.getDate();
  if(el('headerDateLabel')) el('headerDateLabel').textContent = dayNames[now.getDay()];
}
setInterval(() => updateHeaderGreeting(), 60000);
document.addEventListener('DOMContentLoaded', () => updateHeaderGreeting());

// ── Sample Data 2024 ──
const SAMPLE_DATA_2024 = {"transactions":[{"id":"s1","date":"2024-01-01","amount":75000,"category":"Income","desc":"Monthly Salary - January"},{"id":"s2","date":"2024-01-03","amount":-3500,"category":"Food","desc":"Groceries at Big Bazaar"},{"id":"s3","date":"2024-01-05","amount":-1200,"category":"Transport","desc":"Fuel for bike"},{"id":"s4","date":"2024-01-05","amount":-15000,"category":"Housing","desc":"Monthly Rent - January"},{"id":"s5","date":"2024-01-07","amount":-1800,"category":"Utilities","desc":"Electricity Bill"},{"id":"s6","date":"2024-01-10","amount":-4500,"category":"Food","desc":"Restaurant dinner with friends"},{"id":"s7","date":"2024-01-12","amount":-2500,"category":"Entertainment","desc":"Movie tickets & popcorn"},{"id":"s8","date":"2024-01-15","amount":-5000,"category":"Shopping","desc":"Clothes shopping - T-shirts & jeans"},{"id":"s9","date":"2024-01-18","amount":-1500,"category":"Health","desc":"Gym membership"},{"id":"s10","date":"2024-01-22","amount":-3200,"category":"Food","desc":"Weekly groceries"},{"id":"s11","date":"2024-01-25","amount":-1500,"category":"Transport","desc":"Auto fare + fuel"},{"id":"s12","date":"2024-01-28","amount":-2000,"category":"Entertainment","desc":"Gaming purchase"},{"id":"s13","date":"2024-02-01","amount":75000,"category":"Income","desc":"Monthly Salary - February"},{"id":"s14","date":"2024-02-02","amount":12500,"category":"Income","desc":"Freelance web design project"},{"id":"s15","date":"2024-02-05","amount":-3800,"category":"Food","desc":"Groceries & vegetables market"},{"id":"s16","date":"2024-02-08","amount":-15000,"category":"Housing","desc":"Monthly Rent - February"},{"id":"s17","date":"2024-02-10","amount":-1500,"category":"Transport","desc":"Bus pass & auto fare"},{"id":"s18","date":"2024-02-12","amount":-2500,"category":"Utilities","desc":"Water bill + internet"},{"id":"s19","date":"2024-02-15","amount":-3500,"category":"Food","desc":"Groceries shopping"},{"id":"s20","date":"2024-02-18","amount":-4500,"category":"Shopping","desc":"Shoes & accessories"},{"id":"s21","date":"2024-02-20","amount":-1200,"category":"Health","desc":"Medicine & doctor visit"},{"id":"s22","date":"2024-02-22","amount":-3000,"category":"Entertainment","desc":"Concert tickets"},{"id":"s23","date":"2024-02-25","amount":-1800,"category":"Transport","desc":"Fuel for weekly commute"},{"id":"s24","date":"2024-03-01","amount":75000,"category":"Income","desc":"Monthly Salary - March"},{"id":"s25","date":"2024-03-05","amount":-4200,"category":"Food","desc":"Groceries at Reliance Fresh"},{"id":"s26","date":"2024-03-08","amount":-15000,"category":"Housing","desc":"Monthly Rent - March"},{"id":"s27","date":"2024-03-10","amount":-2000,"category":"Transport","desc":"Fuel & auto fare"},{"id":"s28","date":"2024-03-12","amount":-1700,"category":"Utilities","desc":"Electricity bill"},{"id":"s29","date":"2024-03-15","amount":-3500,"category":"Food","desc":"Weekly groceries"},{"id":"s30","date":"2024-03-18","amount":-6500,"category":"Shopping","desc":"Summer clothes shopping"},{"id":"s31","date":"2024-03-20","amount":-2000,"category":"Entertainment","desc":"Sports match tickets"},{"id":"s32","date":"2024-03-22","amount":-1500,"category":"Health","desc":"Dental checkup"},{"id":"s33","date":"2024-03-25","amount":-2500,"category":"Food","desc":"Groceries & food items"},{"id":"s34","date":"2024-04-01","amount":75000,"category":"Income","desc":"Monthly Salary - April"},{"id":"s35","date":"2024-04-05","amount":-3000,"category":"Food","desc":"Groceries shopping"},{"id":"s36","date":"2024-04-08","amount":-15000,"category":"Housing","desc":"Monthly Rent - April"},{"id":"s37","date":"2024-04-10","amount":-1800,"category":"Transport","desc":"Fuel & transport"},{"id":"s38","date":"2024-04-12","amount":-2500,"category":"Utilities","desc":"Water & electricity"},{"id":"s39","date":"2024-04-15","amount":-4000,"category":"Food","desc":"Groceries at nearby store"},{"id":"s40","date":"2024-04-18","amount":-5500,"category":"Shopping","desc":"Online shopping - gadgets"},{"id":"s41","date":"2024-04-20","amount":-3500,"category":"Entertainment","desc":"Movie & dining out"},{"id":"s42","date":"2024-04-22","amount":-1200,"category":"Health","desc":"Health checkup"},{"id":"s43","date":"2024-04-25","amount":-2800,"category":"Food","desc":"Weekly groceries"},{"id":"s44","date":"2024-05-01","amount":75000,"category":"Income","desc":"Monthly Salary - May"},{"id":"s45","date":"2024-05-05","amount":-4500,"category":"Food","desc":"Groceries & household items"},{"id":"s46","date":"2024-05-08","amount":-15000,"category":"Housing","desc":"Monthly Rent - May"},{"id":"s47","date":"2024-05-10","amount":-2200,"category":"Transport","desc":"Fuel & public transport"},{"id":"s48","date":"2024-05-12","amount":-2000,"category":"Utilities","desc":"Electricity + water bill"},{"id":"s49","date":"2024-05-15","amount":-3800,"category":"Food","desc":"Groceries shopping"},{"id":"s50","date":"2024-05-18","amount":-4200,"category":"Shopping","desc":"Clothing & accessories"},{"id":"s51","date":"2024-05-20","amount":-2500,"category":"Entertainment","desc":"Cafe & entertainment"},{"id":"s52","date":"2024-05-22","amount":-1600,"category":"Health","desc":"Pharmacy - medicines"},{"id":"s53","date":"2024-05-25","amount":-3200,"category":"Food","desc":"Weekly groceries"},{"id":"s54","date":"2024-06-01","amount":75000,"category":"Income","desc":"Monthly Salary - June"},{"id":"s55","date":"2024-06-05","amount":-5200,"category":"Food","desc":"Groceries at hypermarket"},{"id":"s56","date":"2024-06-08","amount":-15000,"category":"Housing","desc":"Monthly Rent - June"},{"id":"s57","date":"2024-06-10","amount":-2500,"category":"Transport","desc":"Fuel & auto expenses"},{"id":"s58","date":"2024-06-12","amount":-3000,"category":"Utilities","desc":"High electricity bill (AC usage)"},{"id":"s59","date":"2024-06-15","amount":-4500,"category":"Food","desc":"Groceries & provisions"},{"id":"s60","date":"2024-06-18","amount":-7500,"category":"Shopping","desc":"Summer clothing haul"},{"id":"s61","date":"2024-06-20","amount":-4000,"category":"Entertainment","desc":"Vacation planning expenses"},{"id":"s62","date":"2024-06-22","amount":-2000,"category":"Health","desc":"Health & wellness"},{"id":"s63","date":"2024-06-25","amount":-3500,"category":"Food","desc":"Weekly groceries"},{"id":"s64","date":"2024-06-28","amount":8000,"category":"Income","desc":"Bonus from freelance work"},{"id":"s65","date":"2024-07-01","amount":75000,"category":"Income","desc":"Monthly Salary - July"},{"id":"s66","date":"2024-07-05","amount":-3800,"category":"Food","desc":"Groceries shopping"},{"id":"s67","date":"2024-07-08","amount":-15000,"category":"Housing","desc":"Monthly Rent - July"},{"id":"s68","date":"2024-07-10","amount":-1900,"category":"Transport","desc":"Fuel & transport"},{"id":"s69","date":"2024-07-12","amount":-2200,"category":"Utilities","desc":"Utilities bill"},{"id":"s70","date":"2024-07-15","amount":-4200,"category":"Food","desc":"Groceries provisions"},{"id":"s71","date":"2024-07-18","amount":-5800,"category":"Shopping","desc":"Tech gadgets shopping"},{"id":"s72","date":"2024-07-20","amount":-2800,"category":"Entertainment","desc":"Movies & dining"},{"id":"s73","date":"2024-07-22","amount":-1500,"category":"Health","desc":"Pharmacy visit"},{"id":"s74","date":"2024-07-25","amount":-3000,"category":"Food","desc":"Weekly groceries"},{"id":"s75","date":"2024-08-01","amount":75000,"category":"Income","desc":"Monthly Salary - August"},{"id":"s76","date":"2024-08-05","amount":-4000,"category":"Food","desc":"Groceries at local market"},{"id":"s77","date":"2024-08-08","amount":-15000,"category":"Housing","desc":"Monthly Rent - August"},{"id":"s78","date":"2024-08-10","amount":-2100,"category":"Transport","desc":"Fuel & commute"},{"id":"s79","date":"2024-08-12","amount":-1800,"category":"Utilities","desc":"Electricity bill"},{"id":"s80","date":"2024-08-15","amount":-3600,"category":"Food","desc":"Groceries shopping"},{"id":"s81","date":"2024-08-18","amount":-3500,"category":"Shopping","desc":"Shopping for home items"},{"id":"s82","date":"2024-08-20","amount":-3000,"category":"Entertainment","desc":"Family outing & meals"},{"id":"s83","date":"2024-08-22","amount":-1400,"category":"Health","desc":"Health supplements"},{"id":"s84","date":"2024-08-25","amount":-2900,"category":"Food","desc":"Weekly groceries"},{"id":"s85","date":"2024-09-01","amount":75000,"category":"Income","desc":"Monthly Salary - September"},{"id":"s86","date":"2024-09-05","amount":-3700,"category":"Food","desc":"Groceries at supermarket"},{"id":"s87","date":"2024-09-08","amount":-15000,"category":"Housing","desc":"Monthly Rent - September"},{"id":"s88","date":"2024-09-10","amount":-2000,"category":"Transport","desc":"Fuel & transport costs"},{"id":"s89","date":"2024-09-12","amount":-1900,"category":"Utilities","desc":"Utilities & bills"},{"id":"s90","date":"2024-09-15","amount":-4100,"category":"Food","desc":"Groceries & provisions"},{"id":"s91","date":"2024-09-18","amount":-4800,"category":"Shopping","desc":"School shopping for family"},{"id":"s92","date":"2024-09-20","amount":-2500,"category":"Entertainment","desc":"Entertainment expenses"},{"id":"s93","date":"2024-09-22","amount":-1300,"category":"Health","desc":"Medical visit & medicines"},{"id":"s94","date":"2024-09-25","amount":-3100,"category":"Food","desc":"Weekly groceries"},{"id":"s95","date":"2024-10-01","amount":75000,"category":"Income","desc":"Monthly Salary - October"},{"id":"s96","date":"2024-10-05","amount":-3900,"category":"Food","desc":"Groceries shopping"},{"id":"s97","date":"2024-10-08","amount":-15000,"category":"Housing","desc":"Monthly Rent - October"},{"id":"s98","date":"2024-10-10","amount":-2300,"category":"Transport","desc":"Fuel & transport"},{"id":"s99","date":"2024-10-12","amount":-2600,"category":"Utilities","desc":"Diwali electricity bills"},{"id":"s100","date":"2024-10-15","amount":-5500,"category":"Food","desc":"Diwali groceries & sweets"},{"id":"s101","date":"2024-10-18","amount":-8500,"category":"Shopping","desc":"Diwali shopping - gifts & decor"},{"id":"s102","date":"2024-10-20","amount":-4500,"category":"Entertainment","desc":"Diwali celebrations"},{"id":"s103","date":"2024-10-22","amount":-2200,"category":"Health","desc":"Health checkup"},{"id":"s104","date":"2024-10-25","amount":-3500,"category":"Food","desc":"Weekly groceries"},{"id":"s105","date":"2024-10-30","amount":10000,"category":"Income","desc":"Diwali bonus from employer"},{"id":"s106","date":"2024-11-01","amount":75000,"category":"Income","desc":"Monthly Salary - November"},{"id":"s107","date":"2024-11-05","amount":-3600,"category":"Food","desc":"Groceries shopping"},{"id":"s108","date":"2024-11-08","amount":-15000,"category":"Housing","desc":"Monthly Rent - November"},{"id":"s109","date":"2024-11-10","amount":-2200,"category":"Transport","desc":"Fuel & transport"},{"id":"s110","date":"2024-11-12","amount":-1800,"category":"Utilities","desc":"Electricity bill"},{"id":"s111","date":"2024-11-15","amount":-4000,"category":"Food","desc":"Groceries & food items"},{"id":"s112","date":"2024-11-18","amount":-3200,"category":"Shopping","desc":"Shopping for winter clothes"},{"id":"s113","date":"2024-11-20","amount":-2000,"category":"Entertainment","desc":"Entertainment & leisure"},{"id":"s114","date":"2024-11-22","amount":-1100,"category":"Health","desc":"Health & wellness"},{"id":"s115","date":"2024-11-25","amount":-3200,"category":"Food","desc":"Weekly groceries"},{"id":"s116","date":"2024-12-01","amount":75000,"category":"Income","desc":"Monthly Salary - December"},{"id":"s117","date":"2024-12-05","amount":-5500,"category":"Food","desc":"Year-end groceries shopping"},{"id":"s118","date":"2024-12-08","amount":-15000,"category":"Housing","desc":"Monthly Rent - December"},{"id":"s119","date":"2024-12-10","amount":-2500,"category":"Transport","desc":"Fuel & year-end travel"},{"id":"s120","date":"2024-12-12","amount":-3000,"category":"Utilities","desc":"High December electricity"},{"id":"s121","date":"2024-12-15","amount":-6000,"category":"Food","desc":"Holiday season groceries & party food"},{"id":"s122","date":"2024-12-18","amount":-9500,"category":"Shopping","desc":"Christmas shopping & gifts"},{"id":"s123","date":"2024-12-20","amount":-5500,"category":"Entertainment","desc":"Year-end celebrations"},{"id":"s124","date":"2024-12-22","amount":-2000,"category":"Health","desc":"Year-end health checkup"},{"id":"s125","date":"2024-12-25","amount":-4000,"category":"Food","desc":"Holiday meals & groceries"},{"id":"s126","date":"2024-12-31","amount":15000,"category":"Income","desc":"Year-end bonus"}],"budgets":{"Food":20000,"Transport":8000,"Housing":15000,"Utilities":2500,"Entertainment":10000,"Shopping":15000,"Health":5000,"Other":5000}};

async function importSampleData(){
  if(transactions.length > 0){
    if(!confirm(`This will add 126 sample transactions from 2024 to your existing ${transactions.length} entries.\n\nContinue?`)) return;
  }
  // Merge — avoid duplicate IDs
  const existingIds = new Set(transactions.map(t=>t.id));
  const toAdd = SAMPLE_DATA_2024.transactions.filter(t=>!existingIds.has(t.id));
  transactions = [...transactions, ...toAdd];
  // Load sample budgets only if none set
  const hasBudgets = Object.values(budgets).some(v=>v>0);
  if(!hasBudgets) budgets = {...SAMPLE_DATA_2024.budgets};
  await saveTransactions();
  await saveBudgets();
  renderAll();
  closeMenu();
  showToast(`Loaded ${toAdd.length} transactions from 2024 📊`, 'success');
}

async function startApp(){
  $('loginOverlay').classList.add('hidden');
  $('appShell').classList.remove('hidden');
  $('fDate').value=new Date().toISOString().slice(0,10);
  populateCategorySelect();
  await loadData();
  const profile=await getUserProfile(currentUserId);
  renderProfileStrip(profile);
  updateHeaderGreeting(profile && profile.name ? profile.name : currentUserId);
  renderAll();
  showToast('Welcome back, ' + (profile.name||currentUserId) + ' 👋', 'success');
  // Re-run greeting immediately after app shell is visible (covers any timing gap)
  setTimeout(() => updateHeaderGreeting(), 50);
}

function resetAuthForms(){
  currentUserId=null;
  switchAuthTab('signin');
  ['suUserId','suPass','suPassConfirm','suFullName','suEmail','suPhone','siUserId','siPass'].forEach(id=>{ if($(id)) $(id).value=''; });
  $('suError').textContent=''; $('siError').textContent='';
  const strip=$('profileStrip'); if(strip) strip.classList.add('hidden-strip');
  const idEl=$('headerUserTag'); if(idEl) idEl.textContent='—';
}

async function handleSignUp(e){
  e.preventDefault();
  const err=$('suError'); err.textContent='';
  const uid=sanitizeUserId($('suUserId').value); const pass=$('suPass').value; const confirmPass=$('suPassConfirm').value;
  const name=$('suFullName').value.trim(); const email=$('suEmail').value.trim(); const phone=$('suPhone').value.trim();
  if(!name){ err.textContent='Please enter your full name.'; return; }
  if(!uid){ err.textContent='Enter a User ID (letters, numbers, . _ -).'; return; }
  if(pass.length<4){ err.textContent='Password must be at least 4 characters.'; return; }
  if(pass!==confirmPass){ err.textContent='Passwords do not match.'; return; }
  const existingHash=await getStoredHash(uid);
  if(existingHash){ err.textContent='That User ID is already taken — sign in instead.'; return; }
  const hash=await sha256Hex(pass);
  await setStoredHash(uid,hash); await setUserProfile(uid,{name,email,phone});
  currentUserId=uid; await startApp();
}

async function handleSignIn(e){
  e.preventDefault();
  const err=$('siError'); err.textContent='';
  const uid=sanitizeUserId($('siUserId').value); const pass=$('siPass').value;
  if(!uid){ err.textContent='Enter your User ID.'; return; }
  if(!pass){ err.textContent='Enter your password.'; return; }
  const existingHash=await getStoredHash(uid);
  if(!existingHash){ err.textContent='No account with that User ID — sign up first.'; return; }
  const hash=await sha256Hex(pass);
  if(hash===existingHash){ currentUserId=uid; await startApp(); }
  else { err.textContent='Incorrect password.'; $('siPass').value=''; }
}

function switchAuthTab(which){
  const isSignin=which==='signin';
  $('panelSignin').classList.toggle('login-panel-active',isSignin); $('panelSignin').hidden=!isSignin;
  $('panelSignup').classList.toggle('login-panel-active',!isSignin); $('panelSignup').hidden=isSignin;
  $('tabSignIn').classList.toggle('login-tab-active',isSignin); $('tabSignIn').setAttribute('aria-selected',isSignin?'true':'false');
  $('tabSignUp').classList.toggle('login-tab-active',!isSignin); $('tabSignUp').setAttribute('aria-selected',isSignin?'false':'true');
  if($('loginHeading')) $('loginHeading').textContent=isSignin?'Welcome back.':'Open a new ledger.';
  $('siError').textContent=''; $('suError').textContent='';
}

function initAuth(){
  resetAuthForms();
  $('signUpForm').addEventListener('submit',handleSignUp);
  $('signInForm').addEventListener('submit',handleSignIn);
  $('forgotLink').addEventListener('click', async ()=>{
    const uid=sanitizeUserId($('siUserId').value);
    if(!uid){ $('siError').textContent='— Enter your User ID first.'; return; }
    const existingHash=await getStoredHash(uid);
    if(!existingHash){ $('siError').textContent='— No account with that User ID.'; return; }
    if(confirm(`This clears the password and all data for "${uid}" on this device. Continue?`)){ await clearUserData(uid); resetAuthForms(); }
  });
}

$('menuLogoutBtn').addEventListener('click', ()=>{
  closeMenu();
  $('appShell').classList.add('hidden');
  $('loginOverlay').classList.add('hidden');
  resetAuthForms();
  // Show home page
  const hp = $('homePage');
  hp.style.display = 'block';
  hp.style.opacity = '0';
  hp.style.transition = 'opacity 0.5s ease';
  requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ hp.style.opacity='1'; }); });
  showToast('Logged out');
});

// ── Theme ──
function getSavedTheme(){ try{ return localStorage.getItem('tally:theme')||'light'; }catch(e){ return 'light'; } }
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme',theme==='dark'?'dark':'light');
  const label=theme==='dark'?'☀️ White':'🌙 Dark';
  ['themeToggle','themeToggleLogin'].forEach(id=>{ const b=$(id); if(b) b.textContent=label; });
}
function toggleTheme(){ const next=getSavedTheme()==='dark'?'light':'dark'; try{ localStorage.setItem('tally:theme',next); }catch(e){} applyTheme(next); }
applyTheme(getSavedTheme());
$('themeToggle').addEventListener('click',toggleTheme);
$('themeToggleLogin').addEventListener('click',toggleTheme);

// ── Navigate from home page to login ──
function homeToLogin(){
  const hp = $('homePage');
  hp.style.opacity='1';
  hp.style.transition='opacity 0.4s ease';
  hp.style.opacity='0';
  setTimeout(()=>{
    hp.style.display='none';
    initAuth();
    $('loginOverlay').classList.remove('hidden');
  }, 400);
}

// ── Logout goes back to home ──
$('menuLogoutBtn').removeEventListener && null; // already bound above

// ═══════════════════════════════════════════════════════
//  SPLASH SCREEN ANIMATION + INIT
// ═══════════════════════════════════════════════════════
(function runSplash(){
  const bar = $('splashBarFill');
  const txt = $('splashLoadingText');
  const messages = [
    'Preparing your ledger…',
    'Loading fonts…',
    'Checking your data…',
    'Almost ready…'
  ];
  let progress = 0;
  let msgIdx = 0;

  const interval = setInterval(()=>{
    progress += Math.random()*16 + 5;
    if(progress >= 100) progress = 100;
    bar.style.width = progress + '%';
    if(progress > 25 && msgIdx < 1){ msgIdx=1; txt.textContent=messages[1]; }
    if(progress > 55 && msgIdx < 2){ msgIdx=2; txt.textContent=messages[2]; }
    if(progress > 80 && msgIdx < 3){ msgIdx=3; txt.textContent=messages[3]; }
    if(progress >= 100){
      clearInterval(interval);
      setTimeout(()=>{
        const splash = $('splashScreen');
        splash.classList.add('fade-out');
        setTimeout(()=>{
          splash.classList.add('hidden');
          // Show home page
          const hp = $('homePage');
          hp.style.display = 'block';
          hp.style.opacity = '0';
          hp.style.transition = 'opacity 0.6s ease';
          requestAnimationFrame(()=>{
            requestAnimationFrame(()=>{ hp.style.opacity = '1'; });
          });
        }, 620);
      }, 400);
    }
  }, 80);
})();

// ── PDF Export ──
function buildPdfHtml(scope){
  const selectedMonth = $('monthFilter').value;
  const d = new Date(selectedMonth+'-01T00:00:00');
  const monthLabel = d.toLocaleString('default',{month:'long',year:'numeric'});

  let txList = scope === 'all'
    ? [...transactions].sort((a,b)=>a.date.localeCompare(b.date))
    : transactions.filter(t=>monthKey(t.date)===selectedMonth).sort((a,b)=>a.date.localeCompare(b.date));

  const income = txList.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const spent  = txList.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
  const net    = income - spent;

  const CATS = [...new Set(txList.filter(t=>t.amount<0).map(t=>t.category))];
  const catRows = CATS.map(c=>{
    const total = txList.filter(t=>t.amount<0&&t.category===c).reduce((s,t)=>s+Math.abs(t.amount),0);
    return `<tr><td>${c}</td><td style="text-align:right">₹${total.toFixed(2)}</td></tr>`;
  }).join('');

  const txRows = txList.map(t=>`
    <tr>
      <td>${t.date}</td>
      <td>${t.desc}${t.note?`<br><small style="color:#888">${t.note}</small>`:''}</td>
      <td>${t.category}</td>
      <td style="text-align:right;color:${t.amount>=0?'#059669':'#DC2626'};font-weight:600">
        ${t.amount>=0?'+':''}₹${Math.abs(t.amount).toFixed(2)}
      </td>
    </tr>`).join('');

  const title = scope==='all' ? 'Full Ledger' : monthLabel;
  const summarySection = scope==='summary' ? '' : `
    <h3>Transactions</h3>
    <table>
      <thead><tr><th>Date</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${txRows}</tbody>
    </table>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Tally — ${title}</title>
  <style>@page { margin: 0; size: A4; } html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Source+Sans+3:wght@300;400;600&family=Space+Mono&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Source Sans 3', sans-serif; color: #111; padding: 40px 48px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #7C3AED; padding-bottom: 14px; margin-bottom: 24px; }
    .brand { font-family: 'Cormorant Garamond', serif; font-size: 32px; font-weight: 700; color: #7C3AED; }
    .brand span { color: #d4a017; }
    .meta { text-align: right; color: #555; font-size: 12px; line-height: 1.6; }
    h3 { font-family: 'Cormorant Garamond', serif; font-size: 18px; font-weight: 600; margin: 24px 0 10px; color: #1a1a2e; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 24px; }
    .summary-card { background: #f9f7ff; border: 1px solid #ede9fe; border-radius: 8px; padding: 14px 16px; }
    .summary-card .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
    .summary-card .val { font-family: 'Space Mono', monospace; font-size: 18px; font-weight: 700; }
    .val.inc { color: #059669; } .val.exp { color: #DC2626; } .val.net { color: #7C3AED; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f5f3ff; color: #555; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; padding: 8px 10px; text-align: left; }
    td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    @media print { body { padding: 20px 28px; } @page { margin: 0; size: A4; } }
  </style></head><body>
  <div class="header">
    <div class="brand">Tally<span>.</span></div>
    <div class="meta">
      <div><strong>${title}</strong></div>
      <div>Generated ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</div>
      <div>User: ${currentUserId||'—'}</div>
    </div>
  </div>
  <h3>Summary</h3>
  <div class="summary-grid">
    <div class="summary-card"><div class="label">Income</div><div class="val inc">₹${income.toFixed(2)}</div></div>
    <div class="summary-card"><div class="label">Spent</div><div class="val exp">₹${spent.toFixed(2)}</div></div>
    <div class="summary-card"><div class="label">Net</div><div class="val net">₹${net.toFixed(2)}</div></div>
  </div>
  ${catRows ? `<h3>By Category</h3><table><thead><tr><th>Category</th><th style="text-align:right">Total</th></tr></thead><tbody>${catRows}</tbody></table>` : ''}
  ${summarySection}
</body></html>`;
}

$('exportPdfBtn').addEventListener('click', ()=>{
  closeMenu();
  $('pdfOverlay').classList.add('active');
});

$('pdfCancelBtn').addEventListener('click', ()=>{
  $('pdfOverlay').classList.remove('active');
});

$('pdfGenerateBtn').addEventListener('click', ()=>{
  const scope = document.querySelector('input[name="pdfScope"]:checked').value;
  const html = buildPdfHtml(scope);
  const frame = $('pdfPrintFrame');
  frame.srcdoc = html;
  $('pdfOverlay').classList.remove('active');
  frame.onload = ()=>{
    setTimeout(()=>{
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }, 300);
  };
});

$('pdfOverlay').addEventListener('click', e=>{
  if(e.target === $('pdfOverlay')) $('pdfOverlay').classList.remove('active');
});

// ── Home page ticker ──
(function initHomeTicker(){
  const tickerData = [
    { date:'01 Sep', desc:'Monthly Salary', sub:'Income', amt:'+₹52,000', type:'inc' },
    { date:'02 Sep', desc:'Rent – Housing', sub:'Housing', amt:'−₹14,500', type:'exp' },
    { date:'03 Sep', desc:'DMart Groceries', sub:'Food', amt:'−₹2,340', type:'exp' },
    { date:'04 Sep', desc:'Electricity Bill', sub:'Utilities', amt:'−₹1,820', type:'exp' },
    { date:'05 Sep', desc:'Freelance Project', sub:'Income', amt:'+₹8,000', type:'inc' },
    { date:'06 Sep', desc:'Jio Recharge', sub:'Utilities', amt:'−₹299', type:'exp' },
    { date:'07 Sep', desc:'Dinner – Zomato', sub:'Food', amt:'−₹640', type:'exp' },
    { date:'08 Sep', desc:'Petrol – BPCL', sub:'Transport', amt:'−₹1,200', type:'exp' },
    { date:'09 Sep', desc:'Netflix + Hotstar', sub:'Leisure', amt:'−₹649', type:'exp' },
    { date:'10 Sep', desc:'Medicine – Apollo', sub:'Health', amt:'−₹450', type:'exp' },
    { date:'11 Sep', desc:'Kids School Fees', sub:'Education', amt:'−₹3,500', type:'exp' },
    { date:'12 Sep', desc:'SIP – Mutual Fund', sub:'Investment', amt:'−₹5,000', type:'exp' },
  ];

  const inner = document.getElementById('homeTickerInner');
  if(!inner) return;

  function makeRows(data){
    return data.map(r => `
      <div class="home-ticker-row ${r.type}">
        <span class="tkr-date">${r.date}</span>
        <span class="tkr-desc">${r.desc}<small>${r.sub}</small></span>
        <span class="tkr-amt">${r.amt}</span>
      </div>`).join('');
  }

  // Double for seamless loop
  const html = makeRows(tickerData) + makeRows(tickerData);
  inner.innerHTML = html;

  // Set animation duration based on row count
  const rowH = 46; // px per row approx
  const totalH = tickerData.length * rowH;
  inner.style.setProperty('--ticker-h', totalH + 'px');
})();

// ── Sidebar ──
(function initSidebar(){
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sbToggleBtn');
  const openBtn = document.getElementById('sbOpenBtn');
  const overlay = document.getElementById('sbMobileOverlay');

  // Collapse/expand (desktop)
  toggleBtn.addEventListener('click', ()=>{
    sidebar.classList.toggle('collapsed');
    toggleBtn.title = sidebar.classList.contains('collapsed') ? 'Expand sidebar' : 'Collapse sidebar';
  });

  // Mobile open/close
  if(openBtn) openBtn.addEventListener('click', ()=>{
    sidebar.classList.add('mobile-open');
    overlay.classList.add('active');
  });
  overlay.addEventListener('click', ()=>{
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
  });

  // Section navigation
  function closeMobileSidebar(){ sidebar.classList.remove('mobile-open'); overlay.classList.remove('active'); }

  // Section navigation using IDs instead of data attributes
  const navMap = [
    { id: 'sbNavDashboard', target: 'appBody' },
    { id: 'sbNavLedger',    target: 'ledgerBody' },
    { id: 'sbNavBudgets',   target: 'budgetInputs' },
    { id: 'sbNavGoals',     target: 'goalsList' },
    { id: 'sbNavRecurring', target: 'recurList' },
    { id: 'sbNavCharts',    target: 'breakdown' },
  ];
  const allNavBtns = navMap.map(n => document.getElementById(n.id)).filter(Boolean);

  navMap.forEach(({ id, target }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      allNavBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      closeMobileSidebar();
      const el = document.getElementById(target);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    });
  });

  // New Entry button
  document.getElementById('sbNewEntryBtn').addEventListener('click', ()=>{
    closeMobileSidebar();
    const amtEl = document.getElementById('fAmount');
    if(amtEl){ amtEl.scrollIntoView({behavior:'smooth', block:'center'}); amtEl.focus(); }
  });

  // Sidebar quick-access for export/logout
  document.getElementById('sbExportPdf').addEventListener('click', ()=>{
    closeMobileSidebar();
    document.getElementById('pdfOverlay').classList.add('active');
  });
  document.getElementById('sbExportCsv').addEventListener('click', ()=>{
    closeMobileSidebar();
    document.getElementById('exportCsvBtn').click();
  });
  document.getElementById('sbLogout').addEventListener('click', ()=>{
    closeMobileSidebar();
    document.getElementById('menuLogoutBtn').click();
  });

  // Populate recent months — store month value in a closure, no data attributes
  function renderSbMonths(){
    const list = document.getElementById('sbMonthList');
    if(!list) return;
    const months = [...new Set((window.transactions||[]).map(t=>t.date.slice(0,7)))].sort((a,b)=>b.localeCompare(a)).slice(0,6);
    if(!months.length){ list.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,0.25);padding:4px 16px;">No entries yet</div>'; return; }
    list.innerHTML = '';
    months.forEach(m => {
      const d = new Date(m+'-01T00:00:00');
      const label = d.toLocaleString('default',{month:'long',year:'numeric'});
      const btn = document.createElement('button');
      btn.className = 'sb-nav-item';
      btn.style.fontSize = '12.5px';
      btn.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.22);flex-shrink:0;display:inline-block;"></span><span class="sb-nav-text">${label}</span>`;
      btn.addEventListener('click', () => {
        const mf = document.getElementById('monthFilter');
        if(mf){ mf.value = m; mf.dispatchEvent(new Event('change')); }
        document.getElementById('ledgerBody').scrollIntoView({behavior:'smooth', block:'start'});
        closeMobileSidebar();
      });
      list.appendChild(btn);
    });
  }

  // Update sidebar user info
  function updateSbUser(){
    const uid = window.currentUserId || '';
    const sbAvatar = document.getElementById('sbAvatar');
    const sbName = document.getElementById('sbUserName');
    if(sbAvatar) sbAvatar.textContent = uid ? uid[0].toUpperCase() : '?';
    if(sbName) sbName.textContent = uid || '—';
  }

  // Hook into renderAll to refresh sidebar months
  const origRenderAll = window.renderAll;
  if(typeof origRenderAll === 'function'){
    window.renderAll = function(){
      origRenderAll.apply(this, arguments);
      renderSbMonths();
      updateSbUser();
    };
  }

  // Also poll until transactions are available
  const poll = setInterval(()=>{
    if(window.transactions !== undefined){
      clearInterval(poll);
      renderSbMonths();
      updateSbUser();
    }
  }, 400);
})();

// ══════════════════════════════════════════════════════
//  PWA: Service Worker + Install Prompt + Offline Toast
// ══════════════════════════════════════════════════════
(function initPWA() {

  // ── 1. Register Service Worker via Blob URL ─────────
  const CACHE_NAME = 'tally-v1';

  const swCode = `
const CACHE = '${CACHE_NAME}';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for same-origin, network-only for external (fonts, etc.)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 408 })));
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const network = fetch(e.request).then(resp => {
          if (resp && resp.status === 200) cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});
`;

  if ('serviceWorker' in navigator) {
    const blob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);
    navigator.serviceWorker.register(swUrl, { scope: './' })
      .then(reg => {
        console.log('[Tally PWA] Service worker registered');
        // Cache the app HTML itself so it works offline
        if ('caches' in window) {
          caches.open(CACHE_NAME).then(c => c.add(location.href).catch(() => {}));
        }
      })
      .catch(err => console.warn('[Tally PWA] SW failed:', err));
  }

  // ── 2. Install Banner (Android / Desktop Chrome) ────
  let deferredPrompt = null;
  const banner     = document.getElementById('pwaInstallBanner');
  const installBtn = document.getElementById('pwaInstallBtn');
  const dismissBtn = document.getElementById('pwaDismissBtn');

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone;
  const dismissed = localStorage.getItem('pwa_banner_dismissed');

  if (!isStandalone && !dismissed) {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      setTimeout(() => banner && banner.classList.add('show'), 4500);
    });
  }

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      banner.classList.remove('show');
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === 'accepted') localStorage.setItem('pwa_banner_dismissed', '1');
      }
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      banner.classList.remove('show');
      localStorage.setItem('pwa_banner_dismissed', '1');
    });
  }

  // ── 3. iOS Safari tip ──────────────────────────────
  const isIos     = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari  = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const iosTipDismissed = localStorage.getItem('pwa_ios_tip_dismissed');
  const iosTip      = document.getElementById('pwaIosTip');
  const iosTipClose = document.getElementById('pwaIosTipClose');

  if (isIos && isSafari && !isStandalone && !iosTipDismissed) {
    setTimeout(() => iosTip && iosTip.classList.add('show'), 4500);
  }
  if (iosTipClose) {
    iosTipClose.addEventListener('click', () => {
      iosTip.classList.remove('show');
      localStorage.setItem('pwa_ios_tip_dismissed', '1');
    });
  }

  // ── 4. Offline / Online toasts ─────────────────────
  const offlineToast = document.getElementById('pwaOfflineToast');
  const onlineToast  = document.getElementById('pwaOnlineToast');

  function showToast(el, ms) {
    if (!el) return;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), ms);
  }

  window.addEventListener('offline', () => showToast(offlineToast, 4000));
  window.addEventListener('online',  () => showToast(onlineToast,  3000));

})();
