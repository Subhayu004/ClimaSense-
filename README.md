# 🌍 ClimaSense — Climate Risk Visualization & Analysis Platform

ClimaSense is a **climate intelligence dashboard** that turns real-time climate conditions into **understandable climate risk insights** using maps, risk analysis, and AI explanations.

Many existing sources (IPCC reports, NASA/NOAA portals) are **too complex for non-experts**. ClimaSense bridges that gap by making climate risk **simple, visual, and actionable**.

---

## ✨ Features (MVP)

- 📍 **Real-time location detection** (browser geolocation)
- 🌡️ **Live climate data** (temperature, humidity, wind speed, rainfall)
- ⚠️ **Climate risk assessment** (Low / Moderate / High)
- 🗺️ **Interactive map with Heatmap toggle**
- 📊 **Climate trends** (temperature & rainfall charts)
- 🤖 **AI verdict + confidence score** (Gemini-powered explanation)

---

## 🚀 MVP Note (Important)

This repository is an **MVP demo**, not the final full-scale product.

- ✅ Uses **limited API calls** (rate-limited services)
- ✅ Includes **some sample/dummy heatmap points** for visualization demo
- ✅ Backend APIs + full system flow are real & functional

Future versions will add full historical datasets, broader region coverage, and alerts.

---

## 🧩 Architecture Overview

```text
User (Web Browser)
   │
   │  Real-time Location (Geolocation API)
   ▼
Frontend Dashboard (HTML / CSS / JavaScript)
   │
   │  API Requests (/api/*)
   ▼
Cloudflare Worker (Secure API Proxy Layer)
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
   ├─ Generate AI-based Explanation (Gemini)
   │
   ▼
AWS DynamoDB
   └─ Stores Climate Data & Analysis Records
```
## 🛠️ TechStack

 ### Backend & Cloud
- AWS Lambda — serverless backend logic

- AWS API Gateway — REST endpoints for frontend integration

- AWS IAM — access control and permissions

 ### Database
 - AWS DynamoDB — stores climate records 
 ### APIs Used
- OpenWeather API — real-time climate/weather info

- Gemini AI API — risk explanation & summarization

- MapTiler (or Map Provider) — map visualization in frontend


 

