const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const aiHandler = require('../easly/aiHandler');
const { db } = require('../config/firebase');

const LOCAL_PATH = path.join(__dirname, '..', 'data', 'ideas.json');

function readLocalIdeas() {
  try { return JSON.parse(fs.readFileSync(LOCAL_PATH, 'utf8') || '[]'); } catch (e) { return []; }
}
function writeLocalIdeas(arr) { fs.writeFileSync(LOCAL_PATH, JSON.stringify(arr, null, 2)); }

// Render ideas UI
router.get('/', (req, res) => {
  // attempt to load from Firestore if available
  if (db && db.collection && typeof db.collection === 'function' && db.collection('ideas').get) {
    // Try Firestore read, but fallback to local
    db.collection('ideas').get().then(snapshot => {
      const items = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() }));
      res.render('ideas', { ideas: items });
    }).catch(() => {
      res.render('ideas', { ideas: readLocalIdeas() });
    });
  } else {
    res.render('ideas', { ideas: readLocalIdeas() });
  }
});

// Create idea via AI (calls aiHandler internally)
router.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'prompt required' });

    // Reuse aiHandler by constructing a fake request body similar to its expectations
    const fakeReq = { body: { imagePart: null, textPart: prompt, responseMimeType: 'application/json' } };
    // aiHandler expects imagePart + textPart; it errors if imagePart missing — create minimal wrapper
    // We'll call easly/aiHandler directly if it accepts text-only; otherwise implement a simple HTTP call to /ai/co-pilot
    let aiResult;
    try {
      // call aiHandler function directly - it returns a response via Express res object normally; instead use axios to call local endpoint
      const axios = require('axios');
      const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
      const r = await axios.post(`${serverUrl}/ai/co-pilot`, { textPart: prompt, responseMimeType: 'application/json' });
      aiResult = r.data;
    } catch (e) {
      // If external AI call fails, return error
      return res.status(500).json({ error: 'AI generation failed', detail: e.message });
    }

    const idea = {
      id: `idea-${Date.now()}`,
      prompt,
      aiResult,
      createdAt: new Date().toISOString()
    };

    // Save to Firestore if available, otherwise local file
    if (db && db.collection && typeof db.collection === 'function' && db.collection('ideas').add) {
      try {
        const docRef = await db.collection('ideas').add(idea);
        idea.id = docRef.id;
      } catch (err) {
        // ignore and fallback to local
      }
    }

    const current = readLocalIdeas();
    current.unshift(idea);
    writeLocalIdeas(current);

    res.json(idea);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
