// assistant-core.js
// Core Easly AI Assistant logic (chat, events, UI shell, messaging, voice stubs, sanitization)
// Namespace pattern to avoid globals
(function(window){
  const EaslyAI = window.EaslyAI = window.EaslyAI || { state:{}, utils:{}, components:{}, version:'1.0.0-modular' };

  // --- State ---
  const state = EaslyAI.state;
  state.archMode = false;
  state.clientId = initClientId();
  state.connected = false;
  state.tts = { enabled:false };
  state.events = { es: null, reconnectAttempts:0, maxReconnect:5 };

  // --- DOM References (lazy) ---
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  function initClientId(){
    try {
      let id = localStorage.getItem('easlyClientId');
      if(!id){ id = 'cli_' + Math.random().toString(36).slice(2); localStorage.setItem('easlyClientId', id); }
      return id;
    } catch { return 'cli_' + Math.random().toString(36).slice(2); }
  }

  // --- Sanitization & Formatting ---
  function formatMessage(raw){
    if(!raw) return '';
    try {
      // Basic markdown-ish replacements before sanitize
      let txt = String(raw)
        .replace(/\r\n|\r/g,'\n')
        .replace(/```([\s\S]*?)```/g, (m, code)=>`<pre class="code-block"><code>${escapeHtml(code)}</code></pre>`)
        .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g,'<em>$1</em>')
        .replace(/`([^`]+)`/g,'<code>$1</code>')
        .replace(/\n\n+/g,'</p><p>')
        .replace(/\n/g,'<br>');
      txt = `<p>${txt}</p>`;
      if(window.DOMPurify){
        return window.DOMPurify.sanitize(txt, {USE_PROFILES:{html:true}});
      }
      return txt;
    } catch { return escapeHtml(String(raw)); }
  }
  function escapeHtml(str){
    return str.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c]));
  }
  EaslyAI.utils.formatMessage = formatMessage;

  function stripHtml(html){ const tmp = document.createElement('div'); tmp.innerHTML = html; return tmp.textContent||tmp.innerText||''; }
  EaslyAI.utils.stripHtml = stripHtml;

  // --- Toast System ---
  function showToast(msg, type='info'){
    let c = $('#toast-container');
    if(!c){
      c = document.createElement('div');
      c.id='toast-container';
      c.style.cssText='position:fixed;bottom:14px;right:14px;display:flex;flex-direction:column;gap:6px;z-index:9999;';
      document.body.appendChild(c);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.style.cssText='background:rgba(20,20,24,.92);color:#fff;padding:8px 12px;border-radius:6px;font-size:.75rem;box-shadow:0 4px 12px rgba(0,0,0,.4);opacity:0;transform:translateY(6px);transition:.3s;';
    el.textContent = msg;
    c.appendChild(el);
    requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='translateY(0)'; });
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(4px)'; setTimeout(()=> el.remove(), 350); }, 4000);
  }
  EaslyAI.utils.showToast = showToast;
  window.showToast = showToast; // compat

  // --- Loading / Thinking indicators ---
  function showLoading(){ const ov = $('#loadingOverlay'); if(ov) ov.style.display='flex'; }
  function hideLoading(){ const ov = $('#loadingOverlay'); if(ov) ov.style.display='none'; }
  function addThinkingMessage(){ if($('#thinking-msg')) return; addMessageToChat('ai', '...thinking...'); const last = $('#ai-chat-history .chat-message:last-child'); if(last) last.id='thinking-msg'; }
  function removeThinkingMessage(){ const t=$('#thinking-msg'); if(t) t.remove(); }
  EaslyAI.utils.showLoading=showLoading; EaslyAI.utils.hideLoading=hideLoading;

  // --- Chat Rendering ---
  function addMessageToChat(sender, content){
    const hist = $('#ai-chat-history'); if(!hist) return;
    const div = document.createElement('div');
    div.className = `chat-message ${sender}-message`;
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    div.innerHTML = `\n      <div class="message-avatar"><div class="avatar-${sender}">${sender==='user'?'👤':'🤖'}</div></div>\n      <div class="message-content">\n        <div class="message-header">\n          <span class="sender-name">${sender==='user'?'You':'Easly AI'}</span>\n          <div class="message-tools">\n            <span class="message-time">${time}</span>\n            ${sender==='ai'?'<button class="speak-btn" aria-label="Speak">🔊</button>':''}\n          </div>\n        </div>\n        <div class="message-text">${formatMessage(content)}</div>\n      </div>`;
    hist.appendChild(div);
    autoScrollIfNearBottom();
    if(sender==='ai'){
      const btn = div.querySelector('.speak-btn'); if(btn) btn.addEventListener('click', ()=> speakText(stripHtml(content)) );
      if(state.tts.enabled) speakText(stripHtml(content));
    }
  }
  EaslyAI.utils.addMessageToChat = addMessageToChat; window.addMessageToChat = addMessageToChat; // compat

  function autoScrollIfNearBottom(){
    const hist = $('#ai-chat-history'); if(!hist) return;
    const near = (hist.scrollHeight - hist.scrollTop - hist.clientHeight) < 120;
    if(near) hist.scrollTo({ top: hist.scrollHeight, behavior:'smooth'});
  }

  // --- Message Submission ---
  async function submitMessage(prompt){
    const input = $('#ai-input'); const sendBtn = $('#sendBtn');
    if(!prompt || !input || input.disabled) return;
    addMessageToChat('user', prompt);
    input.value=''; resizeInput(); input.disabled=true; updateSendState(); showLoading(); addThinkingMessage();
    try {
      const payload = { textPart: prompt, clientId: state.clientId };
      const endpoint = state.archMode ? '/ai/co-pilot-arch' : '/ai/co-pilot';
      const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const data = await res.json();
      removeThinkingMessage(); hideLoading();
      let text = data.response || data.text || JSON.stringify(data, null,2);
      if(Array.isArray(data.options) && data.options.length){
        text += renderOptionsChips(data.options);
      }
      addMessageToChat('ai', text);
    } catch(err){
      console.error(err); removeThinkingMessage(); hideLoading(); addMessageToChat('ai','Sorry, an error occurred.'); showToast('Request failed','error');
    } finally { if(input){ input.disabled=false; updateSendState(); input.focus(); } }
  }
  EaslyAI.utils.submitMessage = submitMessage; window.submitMessage=submitMessage;

  function renderOptionsChips(options){
    try {
      const html = options.map(o=>`<button class="chip option-chip" data-send="${escapeHtml(o.send||o.label||'')}">${escapeHtml(o.label||o.send||'')}</button>`).join(' ');
      setTimeout(()=> $$('.option-chip').forEach(btn=> btn.addEventListener('click', ()=> submitMessage(btn.getAttribute('data-send'))) ),0);
      return `<div class="options-wrap" style="margin-top:.5rem;display:flex;flex-wrap:wrap;gap:.5rem;">${html}</div>`;
    } catch { return ''; }
  }

  // --- Input handling ---
  function resizeInput(){ const input = $('#ai-input'); if(!input) return; input.style.height='auto'; input.style.height=Math.min(input.scrollHeight,120)+'px'; }
  function updateSendState(){ const input=$('#ai-input'), btn=$('#sendBtn'); if(!input||!btn) return; const has=input.value.trim().length>0; btn.disabled=!has||input.disabled; }
  function handleKey(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); const val=$('#ai-input').value.trim(); if(val) submitMessage(val); }}

  // --- SSE Events ---
  function initEventsStream(){
    const dot = $('#eventsStatusDot');
    if(state.events.es) { state.events.es.close(); }
    const es = new EventSource('/ai/events');
    state.events.es = es;
    if(dot) dot.style.background='#e3b341';
    es.onopen = ()=>{ state.connected=true; if(dot) dot.style.background='#22c55e'; state.events.reconnectAttempts=0; };
    es.onerror = ()=>{
      state.connected=false; if(dot) dot.style.background='#dc2626'; es.close();
      if(state.events.reconnectAttempts < state.events.maxReconnect){
        const backoff = Math.min(5000, 500 * Math.pow(2, state.events.reconnectAttempts));
        state.events.reconnectAttempts++; setTimeout(initEventsStream, backoff);
      } else {
        showToast('Real-time connection lost. Refresh to retry.','warning');
      }
    };
    es.onmessage = (ev)=>{
      // Expect NDJSON or JSON lines with {type, data}
      if(!ev.data) return;
      try {
        const line = JSON.parse(ev.data);
        if(line.type==='ai.reply' && line.text){ addMessageToChat('ai', line.text); }
        if(/^ai\.tool/.test(line.type)) { /* could render trace later */ }
      } catch {}
    };
  }
  EaslyAI.utils.initEventsStream = initEventsStream;

  // --- Voice (basic TTS only; STT handled elsewhere or optionally) ---
  function speakText(text){ try { if(!('speechSynthesis' in window)) return; const u = new SpeechSynthesisUtterance(text); speechSynthesis.speak(u);} catch {} }
  function isTTSEnabled(){ return !!state.tts.enabled; }
  EaslyAI.utils.speakText = speakText; EaslyAI.utils.isTTSEnabled=isTTSEnabled;
  window.speakText = speakText; window.isTTSEnabled=isTTSEnabled;

  // --- Settings ---
  const settings = { voiceResponses:false, showTimestamps:true };
  EaslyAI.state.settings = settings;
  function updateSetting(key,val){ settings[key]=val; try { localStorage.setItem('easly.settings', JSON.stringify(settings)); } catch {} }
  EaslyAI.utils.updateSetting = updateSetting; window.updateSetting = updateSetting;
  function loadSettings(){ try { const raw = localStorage.getItem('easly.settings'); if(raw){ Object.assign(settings, JSON.parse(raw)); } } catch {} }
  loadSettings();

  // --- Panel Toggle & Header compacting ---
  function initLayout(){
    const panelToggleBtn = $('#panelToggleBtn');
    const sidePanel = $('.ai-side-panel');
    function setCollapsed(collapsed, init){
      if(!sidePanel) return; sidePanel.classList.toggle('collapsed', collapsed);
      if(panelToggleBtn){ panelToggleBtn.classList.toggle('active', collapsed); panelToggleBtn.setAttribute('aria-expanded', String(!collapsed)); panelToggleBtn.textContent = collapsed? 'Panel ▸':'Panel ▾'; }
      if(!init){ try { localStorage.setItem('easly.ai.panelCollapsed', collapsed?'1':'0'); } catch {} }
    }
    if(panelToggleBtn){ panelToggleBtn.addEventListener('click', ()=> setCollapsed(!sidePanel.classList.contains('collapsed')) ); }
    try { setCollapsed(localStorage.getItem('easly.ai.panelCollapsed')==='1', true); } catch {}

    const header = $('.ai-header');
    let lastScroll = window.scrollY;
    function applyHeaderState(){ if(!header) return; const down = window.scrollY>40 && window.scrollY>lastScroll; header.classList.toggle('compact', down); lastScroll=window.scrollY; }
    window.addEventListener('scroll', applyHeaderState, { passive:true }); applyHeaderState();
  }

  // --- Event Bindings ---
  document.addEventListener('DOMContentLoaded', ()=>{
    state.archMode = localStorage.getItem('easly.archMode')==='1';
    const archToggle = $('#archModeToggle'); if(archToggle){ archToggle.checked = state.archMode; archToggle.addEventListener('change', e=> { state.archMode = e.target.checked; try { localStorage.setItem('easly.archMode', state.archMode?'1':'0'); } catch {}; showToast(`Architect mode ${state.archMode?'enabled':'disabled'}`,'info'); }); }

    const form = $('#ai-form'); const input = $('#ai-input'); const sendBtn = $('#sendBtn');
    if(form){ form.addEventListener('submit', e=>{ e.preventDefault(); const v=input.value.trim(); if(v) submitMessage(v); }); }
    if(input){ ['input','keyup','paste','cut'].forEach(ev=> input.addEventListener(ev, ()=>{ resizeInput(); updateSendState(); }) ); input.addEventListener('keydown', handleKey); resizeInput(); updateSendState(); setTimeout(()=> input.focus(), 120); }

    initLayout();
    initEventsStream();
    showToast('Assistant ready','success');
  });

})(window);
