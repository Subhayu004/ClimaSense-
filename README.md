# ClimaSense - Climate Risk Dashboard

A modern climate risk assessment dashboard with AI-powered insights using Gemini API.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm
- Gemini API Key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Subhayu004/ClimaSense-.git
cd ClimaSense-
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Add your Gemini API key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=3000
NODE_ENV=production
```

4. Start the server:
```bash
npm start
```

5. Open your browser:
   - Visit `http://localhost:3000`

## ⚠️ IMPORTANT: Do NOT Use Live Server!

**Live Server only serves static files and will NOT run the backend server.**

The AI chat requires the Node.js backend to be running. Always use:
```bash
npm start
```

## 🌐 Deploying to Render

### Step 1: Create Web Service
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository

### Step 2: Configure Build Settings
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### Step 3: Set Environment Variables
In Render dashboard, add these environment variables:
- `GEMINI_API_KEY` = `your_gemini_api_key`
- `NODE_ENV` = `production`
- `PORT` = `3000` (or leave blank, Render sets this automatically)

### Step 4: Deploy
- Click "Create Web Service"
- Wait for deployment to complete
- Your app will be live at `https://your-app-name.onrender.com`

## 🎯 Features

- **Real-time Climate Data**: Temperature, humidity, wind speed, rainfall
- **Risk Assessment**: Heat, flood, and drought risk analysis
- **Interactive Map**: Heatmap visualization with climate risk zones
- **AI Assistant**: Powered by Gemini API for climate insights
- **Historical Trends**: Temperature and rainfall charts (21 years of data)

## 🔑 Getting Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key and add it to your `.env` file

## 📁 Project Structure

```
ClimaSense/
├── server.js           # Node.js backend server
├── index.html          # Main HTML file
├── style.css           # Styles
├── script.js           # Frontend JavaScript
├── package.json        # Dependencies
├── .env               # Environment variables (DO NOT COMMIT!)
├── .env.example       # Environment template
└── Data/              # CSV data files
    ├── Temperature data.csv
    └── SP-India-Rainfall-act-dep_1901_to_2019_0.csv
```

## 🛠️ Technology Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Maps**: Leaflet.js with OpenStreetMap
- **Charts**: Chart.js
- **AI**: Google Gemini API

## 📝 License

MIT License

## 👥 Authors

Subhayu and Sreyasi
