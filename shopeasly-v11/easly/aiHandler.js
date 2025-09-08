// easly/aiHandler.js
const axios = require('axios');

// Handles AI co-pilot prompt and Gemini API call
module.exports = async function handleAICoPilot(req, res) {
    try {
        const { imagePart, textPart, responseMimeType } = req.body;
        if (!imagePart || !textPart) {
            return res.status(400).json({ error: 'Missing imagePart or textPart' });
        }
        // Prepare Gemini API request
        const apiKey = process.env.GEMINI_API_KEY;
        const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey;
        const prompt = {
            contents: [
                { role: 'user', parts: [
                    { inline_data: { mime_type: 'image/png', data: imagePart } },
                    { text: textPart }
                ] }
            ],
            generationConfig: {
                response_mime_type: responseMimeType || 'application/json'
            }
        };
        const response = await axios.post(geminiUrl, prompt, {
            headers: { 'Content-Type': 'application/json' }
        });
        // Gemini returns JSON in candidates[0].content.parts[0].text
        const aiJson = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        let result;
        try {
            result = JSON.parse(aiJson);
        } catch (e) {
            return res.status(500).json({ error: 'Invalid JSON from Gemini', raw: aiJson });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
