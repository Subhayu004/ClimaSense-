# 🌦️ ClimaSense — AI-Powered Climate Decision Assistant

ClimaSense is a smart, cross-platform application built with Flutter that helps users understand weather, climate patterns, and environmental risks in a clear, human-friendly way.  
The goal is simple: **turn raw climate data into decisions people can actually use.**

---

## 🚀 Why ClimaSense?

Most weather and climate apps:
- dump raw data
- assume users understand technical terms
- don’t explain *what the data means for you*

ClimaSense focuses on **interpretation**, not just information.

It answers questions like:
- *Should I travel today?*
- *Is this weather safe for outdoor work?*
- *What does this climate trend actually imply?*

---

## 🧠 Key Features

- 📊 **Climate & Weather Insights**  
  Converts complex climate data into simple explanations.

- 🤖 **AI-Powered Explanation Layer**  
  Uses an AI service to explain forecasts, risks, and trends in plain language.

- 🔄 **Real-time Data Handling**  
  Fetches and processes live weather and environmental data.

- 📱 **Cross-Platform UI**  
  Built with Flutter — runs on Android, iOS, and Web from a single codebase.

- ☁️ **Cloud-Based Backend**  
  Secure APIs and services hosted on AWS.

---

## 🛠️ Tech Stack

### Frontend
- **HTML**
- **CSS**


### Backend & Cloud
- **AWS Lambda** — serverless API logic  
- **AWS API Gateway** — secure REST endpoints  
- **AWS IAM** — controlled access & permissions  

### Database & Auth
- **Dynamo DB**

### APIs Used :
- **OpenWeather** - For Weather Info
- **Gemini** - For AI
- **MapTiler** - For location Visualization
- **AWS API GateWay Endpoints*** - To use the AWS backend functionalities efficiently 

### AI Layer
- AI API (LLM-based) for climate explanation & summarization

---

## 🧩 Architecture Overview

User (Web Browser)
   │
   │  Real-time Location (Geolocation API)
   ▼
Frontend Dashboard (HTML / CSS / JavaScript)
   │
   │  API Requests (/api/*)
   ▼
Cloudflare Worker (API Proxy Layer)
   │
   │  • Handles CORS
   │  • Protects API Keys
   │  • Routes Requests Securely
   ▼
AWS API Gateway
   │
   ▼
AWS Lambda Functions
   │
   ├─ Fetch Real-time Climate Data (OpenWeather API)
   ├─ Perform Climate Risk Analysis
   ├─ Generate AI-based Risk Explanation (Gemini)
   │
   ▼
AWS DynamoDB
   │
   └─ Stores Climate Data & Analysis Results

