#!/usr/bin/env node
/**
 * build-knowledge.js
 * Scans training/knowledge source files, normalizes them, and writes data/product_knowledge.json
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const KNOWLEDGE_SRC = path.join(__dirname, '..', 'knowledge');
const OUTPUT_PATH = path.join(__dirname, '..', '..', 'data', 'product_knowledge.json');

const SUPPORTED_EXT = new Set(['.md', '.txt', '.json', '.csv', '.ndjson']);

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap(name=>{
    const p = path.join(dir,name);
    const stat = fs.statSync(p);
    if(stat.isDirectory()) return walk(p);
    return [p];
  });
}

function hash(content){ return crypto.createHash('sha256').update(content).digest('hex').slice(0,12); }

function isLikelySecret(line){
  return /(api_key|secret|-----BEGIN|AKIA[A-Z0-9]{16}|sk-live|xoxb-|ghp_)/i.test(line);
}

function chunkMarkdown(raw){
  const lines = raw.split(/\r?\n/);
  const chunks = [];
  let current = { title: 'Introduction', content: [] };
  for(const line of lines){
    const h = line.match(/^(#{2,3})\s+(.*)/); // ## or ###
    if(h){
      if(current.content.length){ chunks.push(current); }
      current = { title: h[2].trim(), content: [] };
    } else {
      current.content.push(line);
    }
  }
  if(current.content.length) chunks.push(current);
  return chunks.map(c=> ({
    id: 'md_'+hash(c.title + c.content.join('\n')), type:'markdown', title:c.title,
    content: c.content.join('\n').trim(), sourceType:'md'
  }));
}

function parseJSON(raw, file){
  try {
    const data = JSON.parse(raw);
    if(Array.isArray(data)) return data.map((d,i)=> ({ id:`json_${hash(file+'_'+i)}`, type:'json', title:d.name||d.title||path.basename(file), content: d, sourceType:'json-array'}));
    return [{ id:`json_${hash(file)}`, type:'json', title:data.name||data.title||path.basename(file), content:data, sourceType:'json-object'}];
  } catch(err){
    console.warn('Failed to parse JSON', file, err.message); return [];
  }
}

function parseCSV(raw, file){
  const lines = raw.split(/\r?\n/).filter(l=>l.trim());
  if(lines.length < 2) return [];
  const headers = lines[0].split(',').map(h=>h.trim());
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(',');
    if(cols.length===0) continue;
    const obj = {};
    headers.forEach((h,idx)=> obj[h] = (cols[idx]||'').trim());
    rows.push(obj);
  }
  return rows.map((r,i)=> ({ id:`csv_${hash(file+'_'+i)}`, type:'product_row', title:r.name||r.title||`Row ${i+1}`, content:r, sourceType:'csv'}));
}

function parseNdjson(raw, file){
  const entries = [];
  raw.split(/\r?\n/).forEach((line,idx)=>{
    if(!line.trim()) return;
    try { const obj=JSON.parse(line); entries.push({ id:`nd_${hash(file+'_'+idx)}`, type:'ndjson', title: obj.name||obj.title||`Item ${idx+1}`, content: obj, sourceType:'ndjson'});} catch {}
  });
  return entries;
}

function parseTxt(raw, file){
  return [{ id:`txt_${hash(file)}`, type:'text', title:path.basename(file), content: raw.trim(), sourceType:'txt'}];
}

function compile(){
  const files = walk(KNOWLEDGE_SRC).filter(f=> SUPPORTED_EXT.has(path.extname(f).toLowerCase()));
  console.log(`🧩 Found ${files.length} knowledge source files.`);
  const compiled = [];
  for(const file of files){
    const ext = path.extname(file).toLowerCase();
    const raw = fs.readFileSync(file,'utf8');
    if(raw.split(/\n/).some(isLikelySecret)){
      console.warn('⛔ Skipping possible secret file:', file);
      continue;
    }
    let items=[];
    if(ext==='.md') items = chunkMarkdown(raw);
    else if(ext==='.json') items = parseJSON(raw,file);
    else if(ext==='.csv') items = parseCSV(raw,file);
    else if(ext==='.ndjson') items = parseNdjson(raw,file);
    else if(ext==='.txt') items = parseTxt(raw,file);
    items.forEach(it=>{ it.sourceFile = path.relative(ROOT, file); });
    compiled.push(...items);
  }

  const output = {
    version: 'kb-1',
    generatedAt: new Date().toISOString(),
    sourceCount: files.length,
    entryCount: compiled.length,
    entries: compiled
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive:true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output,null,2));
  console.log(`✅ Wrote knowledge file: ${OUTPUT_PATH}`);
  console.log(`   Entries: ${output.entryCount}`);
}

compile();
