const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Voice Chatbot Backend is running!' });
});

// Chat endpoint (Gemini)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, language = "Hindi" } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 1️⃣ Detect intent
    const intent = await detectIntent(message);
    console.log("Detected intent:", intent);

    // 2️⃣ Build domain prompt
    const prompt = buildPrompt(intent, message, language);

    // 3️⃣ Call Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 220
        }
      })
    });

    const data = await geminiResponse.json();

    const aiResponse =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "माफ़ कीजिए, मैं अभी जवाब नहीं दे पा रहा हूँ।";

    res.json({
      intent,
      response: aiResponse
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



function buildPrompt(intent, message, language) {
  const baseRules = `
You are Kisan Mitra, an expert Indian agriculture assistant.
You think in Hindi first.
You give practical, field-tested advice.
Avoid generic AI answers.
Use simple farmer-friendly language.
`;

  const intentPrompts = {
    pest: `
You are a crop protection expert.
Ask crop name and symptoms if missing.
Suggest immediate treatment and prevention.
`,

    fertilizer: `
You are a soil and fertilizer expert.
Give dosage, timing, and method.
Avoid chemical overuse.
`,

    irrigation: `
You are an irrigation advisor.
Suggest water quantity and schedule.
Consider season and crop stage.
`,

    weather: `
You are a weather-based farming advisor.
Explain impact on crops.
Give precautions.
`,

    government_scheme: `
You are an Indian agriculture scheme expert.
Explain eligibility and benefits clearly.
`,

    general: `
You are a helpful farming assistant.
`
  };

  return `
SYSTEM:
${baseRules}
${intentPrompts[intent]}

RULES:
- Respond ONLY in ${language}
- Keep response practical (3–5 sentences)
- Ask ONE follow-up question if needed

FARMER QUESTION:
${message}
`;
}





async function detectIntent(message) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `
Classify the farmer's query into ONE intent only.

Possible intents:
- pest
- fertilizer
- irrigation
- weather
- government_scheme
- general

Reply with ONLY the intent word.

Query:
"${message}"
`
        }]
      }],
      generationConfig: { temperature: 0 }
    })
  });

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "general";
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});