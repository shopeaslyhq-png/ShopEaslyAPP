// assistant-extras.js
// Supplemental delegated handlers (voice, settings) after inline purge.
(function(window){
  const $ = (s,ctx=document)=>ctx.querySelector(s);
  const showToast = window.showToast || function(m){ console.log('[toast]', m); };
  const submitMessage = window.submitMessage;
  if(!submitMessage){ return; }

  // Voice recording stub bridging previous inline functions if still needed
  let recognition, isRecording=false;
  try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(SpeechRecognition){
      recognition = new SpeechRecognition();
      recognition.interimResults=false; recognition.lang='en-US';
      recognition.onresult = e=>{ const transcript=e.results[0][0].transcript; const input=$('#ai-input'); if(input){ input.value=transcript; const evt=new Event('input'); input.dispatchEvent(evt);} stopVoice(); };
      recognition.onerror = evt=>{ showToast('Voice error: '+evt.error,'error'); stopVoice(); };
      recognition.onend = ()=>{ if(isRecording) stopVoice(); };
    }
  } catch {}

  function startVoice(){ if(!recognition){ showToast('Voice not supported','warning'); return; } try { recognition.start(); isRecording=true; $('#voiceBtn')?.classList.add('recording'); $('#voiceStatus')?.setAttribute('style','display:flex;'); } catch(e){ showToast('Mic start failed','error'); } }
  function stopVoice(){ isRecording=false; $('#voiceBtn')?.classList.remove('recording'); $('#voiceStatus')?.style && ($('#voiceStatus').style.display='none'); try { recognition && recognition.stop(); } catch {} }
  function toggleVoice(){ isRecording?stopVoice():startVoice(); }
  window.toggleVoiceRecording = toggleVoice; // compat (will be removed once CSP enforced)

  document.addEventListener('click', e=>{
    const t = e.target;
    if(!(t instanceof HTMLElement)) return;
    if(t.closest('[data-voice-toggle]')){ toggleVoice(); }
  });

  // Keyboard Enter to send (removed inline attr)
  document.addEventListener('keydown', e=>{
    const input = $('#ai-input');
    if(!input) return;
    if(e.target===input && e.key==='Enter' && !e.shiftKey){ e.preventDefault(); const v=input.value.trim(); if(v) submitMessage(v); }
  });

  // Settings toggles without inline onchange
  function bindSettingToggle(id, key){ const el = $(id); if(!el) return; el.addEventListener('change', ()=>{ try { window.updateSetting && window.updateSetting(key, el.checked); showToast('Setting updated','info'); } catch{} }); }
  bindSettingToggle('#voiceResponsesToggle','voiceResponses');
  bindSettingToggle('#autoSuggestionsToggle','autoSuggestions');
  bindSettingToggle('#showTimestampsToggle','showTimestamps');

})(window);
