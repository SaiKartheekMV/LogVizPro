# 🚀 LogViz Pro  
### **Smart Log Analyzer & Visualizer using Dockerized Microservices**

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React%20(Vite)-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-Node.js-43853D?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Database-MongoDB-4EA94B?logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Container-Docker-2496ED?logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</p>

---

## 🔍 Overview
**LogViz Pro** is a **lightweight alternative to the ELK Stack**, built to simplify **log management, analytics, and real-time visualization**.  
It uses a **modular microservices architecture** and **Dockerized deployment**, perfect for small teams, student projects, and startups.

---

## ✨ Key Features
- ⚙️ **Microservices Architecture** – Independent backend, frontend & analytics services  
- 🐳 **Dockerized Deployment** – Easy setup, scaling, and portability  
- 📊 **Real-Time Visualization** – Interactive dashboard with live log updates  
- 💾 **MongoDB Integration** – Efficient storage for structured log data  
- ⚡ **Lightweight & Fast** – Optimized for performance and simplicity  
- 🔍 **Developer-Friendly** – Modular, extensible, and easy to maintain  

---

## 🧩 Project Structure
```bash
LogVizPro/
├── visualizer/               # React (Vite) frontend
│   ├── src/
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── services/
│   ├── log-analyzer/         # Log analysis microservice (Python)
│   │   ├── analyzer.py
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── log-collector/        # Log collection microservice (Node.js)
│       ├── app.py
│       ├── Dockerfile
│       └── requirements.txt
└── docker-compose.yml        # Docker orchestration


🛠️ Tech Stack
Layer	Technology
Frontend	React (Vite), Chart.js / Recharts
Backend	Node.js, Express
Database	MongoDB
Containerization	Docker, Docker Compose
Logging	Winston
API Docs	Swagger


🚀 Getting Started
1️⃣ Clone the Repository
git clone https://github.com/<your-username>/LogVizPro.git
cd LogVizPro

2️⃣ Run with Docker Compose
docker-compose up --build

3️⃣ Access the Dashboard

Open your browser at 👉 http://localhost:5173

🧭 Implementation Phases
Phase	Description	Duration
1	Project setup & microservices architecture	2–3 days
2	Log Collector service	3–4 days
3	Log Analyzer service	3–4 days
4	Frontend Visualizer	5–6 days
5	Dockerization & deployment	2–3 days
6	Testing & integration	4–5 days
🌟 Future Enhancements

🧠 AI-powered anomaly detection

📈 Predictive analytics dashboard

🔒 Role-based authentication

☁️ Cloud deployment for multi-environment support

📌 Why "LogViz Pro"?

Log → Core functionality: log management

Viz → Real-time visualization

Pro → Professional, production-ready

Short, meaningful, and powerful.

🤝 Contribution

Contributions are welcome!

Fork the repo

Create your branch → git checkout -b feature/YourFeature

Commit → git commit -m "Add new feature"

Push → git push origin feature/YourFeature

Open a Pull Request
