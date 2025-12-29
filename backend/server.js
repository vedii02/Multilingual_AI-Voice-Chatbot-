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
    const { message, language } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('Received message:', message, 'Language:', language);

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a helpful multilingual voice assistant. Respond in the SAME language as the user. Keep replies short (2-3 sentences).

User said: "${message}"
User language: ${language}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 150
        }
      })
    });

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error('Gemini Error:', data);
      return res.status(500).json({ 
        error: 'Gemini API error', 
        details: data.error?.message || 'Unknown error'
      });
    }

    const aiResponse =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Sorry, I could not generate a response.';

    console.log('AI Response:', aiResponse);

    res.json({ response: aiResponse });

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});
