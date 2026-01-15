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

// API endpoint for real-time weather data from OpenWeatherMap
app.get('/api/weather', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        if (!OPENWEATHER_API_KEY) {
            return res.status(500).json({ error: 'OpenWeather API key not configured' });
        }

        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`OpenWeather API error: ${response.status}`);
        }

        const data = await response.json();

        // Extract relevant climate metrics
        const climateData = {
            temperature: Math.round(data.main.temp),
            humidity: data.main.humidity,
            wind_speed: data.wind.speed,
            rainfall: data.rain ? (data.rain['1h'] || data.rain['3h'] || 0) : 0,
            region: data.name
        };

        res.json(climateData);
    } catch (error) {
        console.error('Weather API Error:', error);
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
});

// Cache for climate grid data to avoid hitting API rate limits
const climateGridCache = new Map();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Helper function to calculate risk severity from weather data
function calculateClimateSeverity(weatherData) {
    let riskScore = 0;

    // Temperature risk
    if (weatherData.temperature > 35) riskScore += 3;
    else if (weatherData.temperature > 30) riskScore += 2;
    else if (weatherData.temperature < 10) riskScore += 2;

    // Rainfall risk (hourly rainfall)
    if (weatherData.rainfall > 50) riskScore += 3;
    else if (weatherData.rainfall > 20) riskScore += 2;
    else if (weatherData.rainfall > 10) riskScore += 1;

    // Humidity risk (drought indicator when combined with high temp)
    if (weatherData.humidity < 30 && weatherData.temperature > 30) riskScore += 2;
    else if (weatherData.humidity < 20) riskScore += 1;

    // Wind speed risk
    if (weatherData.wind_speed > 15) riskScore += 2;
    else if (weatherData.wind_speed > 10) riskScore += 1;

    if (riskScore >= 5) return 'High';
    if (riskScore >= 3) return 'Moderate';
    return 'Low';
}

// API endpoint for climate-based heatmap grid
app.get('/api/climate-grid', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        if (!OPENWEATHER_API_KEY) {
            return res.status(500).json({ error: 'OpenWeather API key not configured' });
        }

        const centerLat = parseFloat(lat);
        const centerLon = parseFloat(lon);
        const cacheKey = `${centerLat.toFixed(2)}_${centerLon.toFixed(2)}`;

        // Check cache first
        const cached = climateGridCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
            console.log('Returning cached climate grid data');
            return res.json(cached.data);
        }

        // Create a 3x3 grid of points (9 total API calls)
        const gridSize = 3;
        const gridSpacing = 0.15; // degrees (~16km at equator)
        const points = [];

        // Generate grid coordinates
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const lat = centerLat + (i - 1) * gridSpacing;
                const lon = centerLon + (j - 1) * gridSpacing;
                points.push({ lat, lon });
            }
        }

        // Fetch weather data for all points in parallel
        const weatherPromises = points.map(async (point) => {
            try {
                const url = `https://api.openweathermap.org/data/2.5/weather?lat=${point.lat}&lon=${point.lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
                const response = await fetch(url);

                if (!response.ok) {
                    console.error(`Weather API failed for point ${point.lat},${point.lon}`);
                    return null;
                }

                const data = await response.json();

                const weatherData = {
                    temperature: Math.round(data.main.temp),
                    humidity: data.main.humidity,
                    wind_speed: data.wind.speed,
                    rainfall: data.rain ? (data.rain['1h'] || data.rain['3h'] || 0) : 0
                };

                const severity = calculateClimateSeverity(weatherData);

                return {
                    lat: point.lat,
                    lon: point.lon,
                    severity: severity,
                    ...weatherData
                };
            } catch (error) {
                console.error(`Error fetching weather for ${point.lat},${point.lon}:`, error);
                return null;
            }
        });

        // Wait for all requests to complete
        const results = await Promise.all(weatherPromises);

        // Filter out failed requests
        const gridData = results.filter(point => point !== null);

        if (gridData.length === 0) {
            return res.status(500).json({ error: 'Failed to fetch weather data for grid' });
        }

        // Cache the results
        climateGridCache.set(cacheKey, {
            data: gridData,
            timestamp: Date.now()
        });

        console.log(`Generated climate grid with ${gridData.length} points`);
        res.json(gridData);
    } catch (error) {
        console.error('Climate Grid API Error:', error);
        res.status(500).json({ error: 'Failed to generate climate grid' });
    }
});

// API endpoint to proxy risk analysis requests to AWS
app.get('/api/analysis/risk', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        const AWS_API_ENDPOINT = process.env.AWS_API_ENDPOINT || 'https://j8wnxa1ezd.execute-api.us-east-1.amazonaws.com';

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        // AWS API expects lat/lon parameters
        const url = `${AWS_API_ENDPOINT}/analysis/risk?lat=${lat}&lon=${lon}`;
        console.log('Proxying risk analysis request to:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`AWS Risk Analysis API error ${response.status}:`, errorText);
            throw new Error(`AWS API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('AWS Risk Analysis response:', data);
        res.json(data);
    } catch (error) {
        console.error('Risk Analysis Proxy Error:', error);
        res.status(500).json({
            error: 'Failed to fetch risk analysis',
            message: error.message
        });
    }
});

// API endpoint to provide AI-powered climate explanation using Groq
app.post('/api/ai/explain', async (req, res) => {
    try {
        const { heat_risk, flood_risk, drought_risk, temperature, humidity, rainfall, lat, lon } = req.body;
        const GROQ_API_KEY = process.env.GROQ_API_KEY;
        const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

        if (!GROQ_API_KEY || GROQ_API_KEY === 'YOUR_GROQ_API_KEY_HERE') {
            return res.status(500).json({
                error: 'Groq API key not configured. Please set GROQ_API_KEY in environment variables.'
            });
        }

        console.log('Generating AI climate analysis using Groq...');
        console.log('Climate data:', { heat_risk, flood_risk, drought_risk, temperature, humidity, rainfall });

        // Create a comprehensive prompt for Groq to analyze the climate situation
        const prompt = `You are an expert climate risk analyst. Based on the following real-time climate data and risk assessments, provide a concise yet comprehensive climate risk analysis.

Current Climate Conditions:
- Temperature: ${temperature}°C
- Humidity: ${humidity}%
- Rainfall: ${rainfall} mm
${lat && lon ? `- Location: ${lat}°, ${lon}°` : ''}

Risk Assessment:
- Heat Risk: ${heat_risk}
- Flood Risk: ${flood_risk}
- Drought Risk: ${drought_risk}

Instructions:
1. Analyze the overall climate risk level based on the individual risk factors (Low/Moderate/High)
2. Provide a brief 2-3 sentence explanation of the current climate situation
3. Mention any immediate concerns or recommendations
4. Keep your response professional, clear, and actionable

IMPORTANT: Write in plain text without any markdown formatting (no asterisks, no bold, no special symbols). Just provide clear, readable sentences that will be displayed directly in a web interface.`;

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile', // Fast and accurate model
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional climate risk analyst providing clear, concise assessments of weather conditions and climate risks.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 400,
                top_p: 0.9
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Groq API error ${response.status}:`, errorText);
            throw new Error(`Groq API error: ${response.status}`);
        }

        const data = await response.json();
        const aiExplanation = data.choices[0]?.message?.content || 'Analysis completed.';

        console.log('✅ Groq AI analysis generated successfully');

        // Calculate confidence based on data availability and risk consistency
        let confidence = 75; // Base confidence

        // Increase confidence if we have complete data
        if (temperature && humidity && rainfall !== undefined) {
            confidence += 5;
        }

        // Adjust confidence based on risk consistency
        const risks = [heat_risk, flood_risk, drought_risk];
        const uniqueRisks = new Set(risks).size;
        if (uniqueRisks === 1) {
            confidence += 10; // All risks are the same - very consistent
        } else if (uniqueRisks === 2) {
            confidence += 5; // Mostly consistent
        }

        res.json({
            explanation: aiExplanation,
            summary: aiExplanation, // Provide both formats for compatibility
            confidence: Math.min(confidence, 95),
            provider: 'Groq AI'
        });

    } catch (error) {
        console.error('AI Explanation Error:', error);
        res.status(500).json({
            error: 'Failed to generate AI explanation',
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
    console.log(` Server running on port ${PORT}`);
    console.log(` Visit: http://localhost:${PORT}`);
});
