// assistant-bulk.js
// Bulk product creation, CSV/Excel import, templates, and product wizard helpers
(function(window){
  const EaslyAI = window.EaslyAI = window.EaslyAI || { state:{}, utils:{} };
  const state = EaslyAI.state;
  state.bulk = state.bulk || { csvData:null, uploadedFile:null };
  const bulkState = state.bulk;

  const $ = (s,ctx=document)=>ctx.querySelector(s);
  const $$ = (s,ctx=document)=>Array.from(ctx.querySelectorAll(s));
  const showToast = window.showToast || function(m){ console.log('[toast]', m); };
  const addMessageToChat = window.addMessageToChat || function(){};

  // Template defaults previously inline
  const templates = {
    apparel: { category:'Apparel', priceRange:[15,35], defaultQuantity:25, suggestedMaterials:['Cotton T-Shirt','Fabric Paint'], hints:'Apparel with size variants (S, M, L, XL, XXL)' },
    drinkware: { category:'Drinkware', priceRange:[12,28], defaultQuantity:20, suggestedMaterials:['Ceramic Mug','Vinyl'], hints:'Drinkware collection with custom designs' },
    stickers: { category:'Stickers', priceRange:[3,12], defaultQuantity:100, suggestedMaterials:['Vinyl Sticker Paper'], hints:'Sticker pack with multiple designs' },
    seasonal: { category:'Apparel', priceRange:[18,40], defaultQuantity:15, suggestedMaterials:['Cotton T-Shirt','Seasonal Design'], hints:'Limited edition seasonal collection' }
  };

  function applyTemplateDefaults(templateType){
    const t = templates[templateType]; if(!t) return;
    // update wizard fields if present
    const catSel = $('#pw-category'); if(catSel) catSel.value = t.category;
    const qty = $('#pw-qty-manual'); if(qty) qty.value = t.defaultQuantity;
    const hints = $('#pw-hints'); if(hints) hints.value = t.hints;
    addMessageToChat('ai', `🎯 Applied **${templateType}** template:\n- **Category:** ${t.category}\n- **Suggested Quantity:** ${t.defaultQuantity}\n- **Price Range:** $${t.priceRange[0]}-${t.priceRange[1]}\n- **Materials:** ${t.suggestedMaterials.join(', ')}\n\nThe Product Wizard is now pre-configured with these settings!`);
  }
  EaslyAI.utils.applyTemplateDefaults = applyTemplateDefaults; window.applyTemplateDefaults = applyTemplateDefaults;

  function openBulkCreation(){ const m = $('#bulkCreationModal'); if(!m) return; m.style.display='flex'; m.setAttribute('aria-hidden','false'); document.body.classList.add('no-scroll'); }
  function closeBulkCreation(){ const m = $('#bulkCreationModal'); if(!m) return; m.style.display='none'; m.setAttribute('aria-hidden','true'); document.body.classList.remove('no-scroll'); }
  window.openBulkCreation = openBulkCreation; window.closeBulkCreation = closeBulkCreation;

  function switchBulkTab(tab){ $$('.bulk-creation-tabs .tab-header').forEach(h=> h.classList.toggle('active', h.getAttribute('data-tab')===tab)); $$('.bulk-creation-tabs .tab-content').forEach(c=> c.classList.toggle('active', c.getAttribute('data-tab')===tab)); }

  // CSV / Excel Handling (lazy SheetJS load)
  function ensureSheetJS(){ return new Promise((resolve,reject)=>{ if(window.XLSX) return resolve(); const s=document.createElement('script'); s.src='https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload=()=>resolve(); s.onerror=()=>reject(new Error('SheetJS load failed')); document.head.appendChild(s); }); }

  function handleFileUpload(file){ if(!file) return; if(file.size>10*1024*1024){ showToast('File must be <10MB','error'); return; } const ext = file.name.split('.').pop().toLowerCase(); const ok = ['csv','xlsx','xls']; if(!ok.includes(ext)){ showToast('Unsupported format','error'); return; } bulkState.uploadedFile = file; if(ext==='csv'){ handleCSVFile(file); } else { ensureSheetJS().then(()=> handleExcelFile(file)).catch(()=> showToast('Excel parser failed','error')); } }

  function handleCSVFile(file){ const rd = new FileReader(); rd.onload = e=> { try { const text=e.target.result; const parsed=parseCSV(text); bulkState.csvData=parsed; displayCSVPreview(parsed); enablePreview(); showToast(`CSV loaded (${parsed.data.length} rows)`, 'success'); } catch(err){ console.error(err); showToast('CSV parse error','error'); } }; rd.readAsText(file); }
  function handleExcelFile(file){ const rd=new FileReader(); rd.onload = e=> { try { const buf=e.target.result; const wb = XLSX.read(buf,{type:'array'}); const sheet = wb.SheetNames[0]; const ws = wb.Sheets[sheet]; const json = XLSX.utils.sheet_to_json(ws,{header:1}); if(json.length<2) throw new Error('Empty sheet'); const headers=json[0].map(h=> String(h||'').trim()); const data=[]; for(let i=1;i<json.length;i++){ const row=json[i]; const obj={}; headers.forEach((h,idx)=> obj[h]= String(row[idx]||'').trim()); if(Object.values(obj).some(v=>v)) data.push(obj); } const parsed={ headers, data }; bulkState.csvData=parsed; displayCSVPreview(parsed); enablePreview(); showToast(`Excel loaded (${data.length} rows)`, 'success'); } catch(err){ console.error(err); showToast('Excel parse error','error'); } }; rd.readAsArrayBuffer(file); }

  function parseCSV(text){ const lines=text.split(/\r?\n/).filter(l=>l.trim()); if(lines.length<2) throw new Error('No data'); const headers = lines[0].split(',').map(h=> h.trim().replace(/"/g,'')); const data=[]; for(let i=1;i<lines.length;i++){ const vals=lines[i].split(',').map(v=> v.trim().replace(/"/g,'')); const obj={}; headers.forEach((h,idx)=> obj[h]= vals[idx]||''); data.push(obj); } return { headers, data }; }

  function enablePreview(){ const p=$('#csvPreview'); if(p) p.disabled=false; const imp=$('#importCsvBtn'); if(imp) imp.disabled = !(bulkState.csvData && bulkState.csvData.data.length); }

  function displayCSVPreview(parsed){ const {headers,data} = parsed; const sec=$('#csvPreviewSection'); const tbl=$('#csvPreviewTable'); const rowCount=$('#csvRowCount'); const validation=$('#csvValidation'); const required=['name','category','price','stock']; if(rowCount) rowCount.textContent=`${data.length} products`; const missing = required.filter(c=> !headers.includes(c)); if(validation){ if(missing.length){ validation.textContent = 'Missing: ' + missing.join(', '); validation.style.color='#dc3545'; } else { validation.textContent='All required columns present ✓'; validation.style.color='#28a745'; } }
    if(tbl){ let html='<table style="width:100%;border-collapse:collapse;font-size:12px">'; html+='<thead><tr>'; headers.forEach(h=> html+=`<th style="border:1px solid #333;padding:4px;background:#111;">${h}</th>`); html+='</tr></thead><tbody>'; data.slice(0,5).forEach(r=>{ html+='<tr>'; headers.forEach(h=> html+=`<td style="border:1px solid #222;padding:4px;">${r[h]||''}</td>`); html+='</tr>'; }); html+='</tbody></table>'; if(data.length>5) html+=`<div style="margin-top:4px;font-style:italic;">...and ${data.length-5} more rows</div>`; tbl.innerHTML = html; }
    if(sec) sec.style.display='block'; }

  function downloadCSVTemplate(){ const template=`name,category,price,stock,description,sku,imageUrl,materials\n"Cool Space T-Shirt","Apparel","25.00","50","Amazing space-themed design","APP-COOL-001","","Cotton T-Shirt;Fabric Paint"`; const blob = new Blob([template],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='product-template.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); showToast('CSV template downloaded','success'); }
  function downloadExcelTemplate(){ ensureSheetJS().then(()=>{ const wb=XLSX.utils.book_new(); const data=[ ['name','category','price','stock','description','sku','imageUrl','materials'], ['Cool Space T-Shirt','Apparel',25.00,50,'Amazing space-themed design','APP-COOL-001','','Cotton T-Shirt;Fabric Paint'] ]; const ws=XLSX.utils.aoa_to_sheet(data); XLSX.utils.book_append_sheet(wb, ws,'Products'); XLSX.writeFile(wb,'product-template.xlsx'); showToast('Excel template downloaded','success'); }).catch(()=> showToast('SheetJS failed','error')); }

  async function importCsvData(){ if(!bulkState.csvData){ showToast('No data','warning'); return; } const { data } = bulkState.csvData; const items = data.map(r=> ({ name:r.name||'', category:r.category||'', price:r.price||'', stock:r.stock||'', description:r.description||'', sku:r.sku||'' })); const valid = items.filter(i=> i.name.trim()); if(!valid.length){ showToast('No valid rows','error'); return; } const btn=$('#importCsvBtn'); if(btn){ btn.disabled=true; btn.textContent='Importing...'; }
    try{ const res = await fetch('/inventory/api/bulk',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ items: valid, defaultCategory: ($('#importCategory')||{value:'Products'}).value }) }); const j= await res.json(); if(!res.ok) throw new Error(j.error||('HTTP '+res.status)); const msg=`Imported ${j.createdCount} item${j.createdCount===1?'':'s'}${j.errors?.length?`, ${j.errors.length} errors`:''}`; showToast(msg, j.errors?.length?'warning':'success'); addMessageToChat('ai', `✅ Bulk import complete. ${msg}.`); } catch(err){ showToast('Import failed: '+err.message,'error'); } finally { if(btn){ btn.disabled=false; btn.textContent='✅ Import to Inventory'; } }
  }

  // Event bindings
  document.addEventListener('DOMContentLoaded', ()=>{
    // Open / close
    $('#openBulkCreationBtn')?.addEventListener('click', openBulkCreation);
    $('#closeBulkCreation')?.addEventListener('click', closeBulkCreation);
    $('#cancelBulkCreation')?.addEventListener('click', closeBulkCreation);
    // Tabs
    document.addEventListener('click', e=>{ if(e.target.classList.contains('tab-header')){ switchBulkTab(e.target.getAttribute('data-tab')); }});
    // Templates
    document.addEventListener('click', e=>{ if(e.target.classList.contains('template-btn')){ const card=e.target.closest('.template-card'); const t=card?.getAttribute('data-template'); if(t) applyTemplateDefaults(t); }});
    // File select
    $('#csvFileBtn')?.addEventListener('click', ()=> $('#csvFileInput')?.click());
    $('#csvFileInput')?.addEventListener('change', e=>{ const f=e.target.files[0]; if(f) handleFileUpload(f); });
    // Dropzone
    const dz = $('#csvDropzone');
    if(dz){ ['dragover','dragleave','drop'].forEach(ev=> dz.addEventListener(ev, e=> e.preventDefault()));
      dz.addEventListener('dragover', ()=> dz.classList.add('dragover'));
      dz.addEventListener('dragleave', ()=> dz.classList.remove('dragover'));
      dz.addEventListener('drop', e=>{ dz.classList.remove('dragover'); const f=e.dataTransfer.files[0]; if(f) handleFileUpload(f); });
      dz.addEventListener('click', ()=> $('#csvFileInput')?.click());
    }
    // Downloads
    $('#downloadTemplate')?.addEventListener('click', downloadCSVTemplate);
    $('#downloadExcelTemplate')?.addEventListener('click', downloadExcelTemplate);
    // Import
    $('#importCsvBtn')?.addEventListener('click', importCsvData);
    // Preview expanded
    $('#csvPreview')?.addEventListener('click', ()=>{ if(!bulkState.csvData){ showToast('No data','warning'); return; } showDetailedPreview(bulkState.csvData); });
  });

  // Detailed preview modal (lite)
  function showDetailedPreview(parsed){ const {headers,data} = parsed; let modal = $('#detailedPreviewModal'); if(!modal){ modal=document.createElement('div'); modal.id='detailedPreviewModal'; modal.className='modal-overlay'; modal.innerHTML='<div class="modal-content" style="max-width:90vw;max-height:90vh;overflow:auto;"><button class="modal-close-btn" data-close>×</button><h2>📊 Data Preview</h2><div id="detailedPreviewTable"></div><div class="modal-actions" style="margin-top:12px;text-align:center;"><button class="btn btn-primary" data-proceed>✅ Proceed</button><button class="btn btn-secondary" data-close>Cancel</button></div></div>'; document.body.appendChild(modal); modal.addEventListener('click', e=>{ if(e.target===modal || e.target.hasAttribute('data-close')) closeDetailedPreview(); if(e.target.hasAttribute('data-proceed')){ closeDetailedPreview(); showToast(`Ready to create ${data.length} products!`,'success'); } }); }
    const tbl = $('#detailedPreviewTable', modal); if(tbl){ let html='<table style="width:100%;border-collapse:collapse;font-size:12px">'; html+='<thead><tr>'; headers.forEach(h=> html+=`<th style="border:1px solid #333;padding:4px;background:#111;">${h}</th>`); html+='</tr></thead><tbody>'; data.forEach(r=>{ html+='<tr>'; headers.forEach(h=> html+=`<td style="border:1px solid #222;padding:4px;">${r[h]||''}</td>`); html+='</tr>'; }); html+='</tbody></table>'; tbl.innerHTML=html; }
    modal.style.display='flex'; document.body.classList.add('no-scroll'); }
  function closeDetailedPreview(){ const m = $('#detailedPreviewModal'); if(m){ m.style.display='none'; document.body.classList.remove('no-scroll'); }}

})(window);
