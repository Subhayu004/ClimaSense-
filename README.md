# ClimaSense - Climate Risk Dashboard

A modern, interactive climate risk dashboard with AI-powered assistance.

## 🚀 Features

- 🌍 Real-time location detection with reverse geocoding
- 🗺️ Interactive climate risk heatmap
- 📊 Historical data visualization (Temperature & Rainfall 2005-2025)
- 🤖 AI climate assistant powered by Google Gemini
- ⚠️ Risk assessments for Heat, Flood, and Drought
- 📈 Real CSV data integration

## 🛠️ Setup & Deployment

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/Subhayu004/climasense.git
cd climasense
```

2. **Install dependencies**
```bash
npm install
```

3. **Create .env file**
```bash
cp .env.example .env
```

4. **Add your API keys to .env**
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=3000
NODE_ENV=development
```

5. **Run the server**
```bash
npm start
```

6. **Open browser**
```
http://localhost:3000
```

### Deploy to Render

1. **Push to GitHub** (without .env file)
```bash
git add .
git commit -m "Deploy to Render"
git push origin main
```

2 **Create New Web Service on Render**
   - Connect your GitHub repository
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Add Environment Variables in Render Dashboard**
   - Go to Environment tab
   - Add: `GEMINI_API_KEY` = your actual key
   - Add: `NODE_ENV` = production

4. **Deploy!**
   - Render will automatically build and deploy
   - Your app will be live at `https://your-app.onrender.com`

## 🔒 Security

✅ API keys are stored in `.env` (never committed to Git)  
✅ Backend proxy keeps keys secure  
✅ Frontend calls backend, not external APIs directly  
✅ `.gitignore` prevents sensitive files from being pushed  

## 📁 Project Structure

```
climasense/
├── server.js           # Express backend server
├── script.js           # Frontend JavaScript
├── index.html          # Main HTML file
├── style.css           # Styles
├── package.json        # Dependencies
├── .env.example        # Environment variables template
├── .env               # Your actual API keys (git ignored)
├── Data/              # CSV data files
│   ├── Temperature data.csv
│   └── SP-India-Rainfall-act-dep_1901_to_2019_0.csv
└── Assets/            # Images and assets
```

## 🌐 API Endpoints

- `POST /api/chat` - AI chat endpoint (proxies to Gemini)
- `GET /api/health` - Health check endpoint

## 👥 Credits

Made by **Subhayu and Sreyasi**

## 📄 License

MIT License
