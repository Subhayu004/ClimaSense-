const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// API endpoint for Gemini chat
app.post('/api/chat', async (req, res) => {
    try {
        const { message, context } = req.body;

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'GEMINI_API_KEY') {
            return res.status(500).json({
                error: 'API key not configured. Please set GEMINI_API_KEY in environment variables.'
            });
        }

        console.log('API Key loaded:', GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 10)}...` : 'NOT LOADED');

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are an expert AI climate assistant for a Climate Risk Dashboard named ClimaSense. You help users understand climate risks, weather patterns, and environmental data based on the provided dashboard context. ${context ? '\n\nDashboard Context:\n' + context : ''}\n\nUser Question: ${message}\n\nInstructions: Provide clear, scientifically accurate, and helpful information. Keep responses concise (2-4 sentences). Be friendly and professional. If the question is unrelated to climate or environmental issues, politely redirect the focus to climate matters.`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 800,
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Gemini API Error ${response.status}:`, errorBody);
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            res.json({ response: data.candidates[0].content.parts[0].text });
        } else {
            throw new Error('Invalid response format from Gemini API');
        }

    } catch (error) {
        console.error('Chat API Error:', error);
        res.status(500).json({
            error: 'Failed to get AI response',
            message: error.message
        });
    }
});

// Config endpoint - provides public configuration to frontend
app.get('/api/config', (req, res) => {
    res.json({
        awsEndpoint: process.env.AWS_API_ENDPOINT || 'https://j8wnxa1ezd.execute-api.us-east-1.amazonaws.com',
        nodeEnv: process.env.NODE_ENV || 'development'
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌍 Visit: http://localhost:${PORT}`);
});
