const WINDOW_SECONDS = 10;
let buffer = [];
let timer = null;
let flood = [];

// load demo file eagerly so Play works the same offline
fetch('./demo.jsonl')
  .then(r => r.ok ? r.text() : null)
  .then(t => { if (t) flood = t.trim().split('\n').filter(Boolean).map(l => { try{return JSON.parse(l)}catch{return null}}).filter(Boolean); })
  .catch(()=>{});

// fallback: fetch from repo path if ./demo.jsonl not served (nginx serves /usr/share/nginx/html)
fetch('/demo_comments.jsonl').catch(()=>{});
fetch('../data/demo_comments.jsonl').catch(()=>{});

const el = id => document.getElementById(id);
const sourceEl = el('source'), liveInputEl = el('liveInput'), bufUl = el('buffer'), bufCount = el('bufCount'), clustersEl = el('clusters');
const cardEl = el('priorityCard'), cardTop = el('cardTop'), cardReply = el('cardReply'), cardWhy = el('cardWhy'), cardUrg = el('cardUrgency'), cardSrc = el('cardSource');

function renderBuffer() {
  bufCount.textContent = buffer.length;
  bufUl.innerHTML = buffer.slice(-20).map(c => `<li><b>${c.user||'viewer'}</b> - ${c.text} <small>(${c.platform})</small></li>`).join('');
  const counts = {};
  buffer.forEach(c => counts[c.platform]=(counts[c.platform]||0)+1);
  clustersEl.innerHTML = Object.entries(counts).map(([k,v])=>`<span>${k}: ${v}</span>`).join('') || '<span>no comments yet</span>';
}

function startWindow() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; sendWindow(); }, WINDOW_SECONDS * 1000);
  if (buffer.length === 0) cardEl.classList.add('hidden');
}

async function sendWindow() {
  if (buffer.length === 0) return;
  const payload = { source: sourceEl.value, window_seconds: WINDOW_SECONDS, comments: buffer.map(c => ({user:c.user, text:c.text, platform:c.platform})) };
  buffer = []; renderBuffer();
  cardReply.textContent = '…analyzing';
  cardEl.classList.remove('hidden');
  try {
    const r = await fetch('/api/analyze', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    if (!r.ok) throw new Error(r.statusText);
    const card = await r.json();
    cardTop.textContent = card.top_cluster ? `${card.top_cluster.label_id} - ${card.top_cluster.count}/${card.total} (${Math.round(card.top_cluster.share*100)}%)` : 'No flood in this Window';
    cardReply.textContent = card.suggested_reply;
    cardWhy.textContent = card.why_now;
    cardUrg.textContent = `Urgency ${card.urgency}`;
    cardSrc.textContent = card.source;
  } catch(e) {
    cardReply.textContent = 'API error - is backend on :8000?';
    cardWhy.textContent = String(e);
  }
}

document.getElementById('playBtn').onclick = async () => {
  // replay demo_comments.jsonl line by line, batch into buffer, fire at Window end
  let lines = flood;
  if (lines.length === 0) {
    try { const t = await fetch('data/demo_comments.jsonl').then(r=>r.text()); lines = t.trim().split('\n').map(l=>JSON.parse(l)); } catch {}
  }
  if (lines.length === 0) lines = [{user:'budi_99', text:'kak harga berapa?', platform:'tiktok'}];
  let i = 0;
  const pump = setInterval(() => {
    if (i >= lines.length) { clearInterval(pump); return; }
    const row = lines[i++];
    buffer.push({user: row.user, text: row.text, platform: row.platform || 'mock'});
    renderBuffer(); startWindow();
  }, 450);
};

document.getElementById('injectBtn').onclick = () => {
  buffer.push({user:'judge', text:'kak mahal amat di sebelah 80k', platform: sourceEl.value === 'mock' ? 'tiktok' : sourceEl.value});
  renderBuffer(); startWindow();
};
document.getElementById('sendBtn').onclick = sendWindow;
sourceEl.onchange = () => {
  liveInputEl.placeholder = sourceEl.value==='shopee' ? '6236215 (session_id)' : sourceEl.value==='tiktok' ? '@tokoku' : 'leave empty for Mock';
};
