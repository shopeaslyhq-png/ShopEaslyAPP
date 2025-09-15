document.addEventListener('DOMContentLoaded', () => {
  const genBtn = document.getElementById('generateIdeaBtn');
  const clearBtn = document.getElementById('clearPromptBtn');
  const promptEl = document.getElementById('ideaPrompt');
  const ideasList = document.getElementById('ideasList');

  genBtn.addEventListener('click', async () => {
    const prompt = promptEl.value.trim();
    if (!prompt) return alert('Please enter a prompt');
    genBtn.disabled = true;
    genBtn.textContent = 'Generating...';
    try {
      const res = await fetch('/ideas/generate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ prompt }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generation failed');

      // prepend to list
      const div = document.createElement('div');
      div.className = 'idea-item';
      div.style = 'border-bottom:1px solid var(--border); padding:12px 0;';
      div.innerHTML = `<div style="display:flex; justify-content:space-between; gap:12px;"><strong>${(json.aiResult && json.aiResult.title) || json.prompt}</strong><small style="color:var(--text-secondary); font-size:0.9rem;">${new Date(json.createdAt).toLocaleString()}</small></div><div style="margin-top:0.5rem; color:var(--text-secondary); white-space:pre-wrap;">${escapeHtml(JSON.stringify(json.aiResult, null, 2))}</div>`;
      ideasList.prepend(div);

      promptEl.value = '';
    } catch (e) {
      alert('AI generation failed: ' + e.message);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Idea';
    }
  });

  clearBtn.addEventListener('click', () => { promptEl.value = ''; });
});

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
