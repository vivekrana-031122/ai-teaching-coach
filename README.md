# AI Teaching Coach ("Agent 1")

[![Python Version](https://img.shields.io/badge/python-3.11%2B-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tech: FastAPI](https://img.shields.io/badge/Tech-FastAPI-009688.svg?logo=fastapi&logoColor=white)](#)
[![Tech: Gemini API](https://img.shields.io/badge/Tech-Gemini%20API-4285F4.svg?logo=google&logoColor=white)](#)
[![Deployment: Docker](https://img.shields.io/badge/Deployment-Docker-2496ED.svg?logo=docker&logoColor=white)](#)

An interactive, web-based study peer assistant powered by the **Google Gemini API** and **FastAPI** that explains complex codebases and daily logs in conversational **Hinglish** (mixing Hindi and English).

---

## 🧠 Core Teaching Principles

Agent 1 is programmed to follow strict interactive educational guidelines:
1.  **Conversational Hinglish:** Explanations feel like discussing code with a peer rather than reading dry textbooks.
2.  **Granular Code Breakdown:** Parses long scripts into small, logical blocks before explaining them.
3.  **Analogy-First Teaching:** Explains underlying computer science logic using everyday analogies before introducing technical jargon.
4.  **Liveness Diagnostics ("Samajh Aaya?"):** Pauses after critical blocks to prompt verification checks before advancing.
5.  **Active Recall Closing:** Concludes sessions by asking the student to explain the main takeaways back in their own words.

---

## 📂 Repository Structure
```
ai-teaching-coach/
├── static/
│   ├── index.html     # Single-page Glassmorphism Chat UI
│   ├── style.css      # Custom dark mode stylesheet (GitHub theme styled)
│   └── app.js         # Fetch client, markdown parsing & syntax highlighting
├── main.py            # FastAPI routing server & Gemini REST integration
├── agent_graph.py     # State graph implementation for chat transitions
├── requirements.txt   # Core Python libraries
├── Dockerfile         # Multi-stage production container build
├── LICENSE            # MIT License file
└── README.md          # Project documentation
```

---

## 📦 Local Setup & Execution

### 1. Prerequisites
*   Python 3.11+
*   A Google Gemini API key from **[Google AI Studio](https://aistudio.google.com/)**.

### 2. Installation Steps
1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/vivekrana-031122/ai-teaching-coach.git
    cd ai-teaching-coach
    ```

2.  **Set Up Virtual Environment:**
    ```bash
    python -m venv .venv
    # Windows:
    .venv\Scripts\activate
    # macOS/Linux:
    source .venv/bin/activate
    ```

3.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure API Keys:**
    Copy the environment template and insert your key:
    ```bash
    cp .env.example .env
    ```
    Open `.env` and configure:
    ```env
    GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
    ```

5.  **Launch FastAPI Server:**
    ```bash
    python -m uvicorn main:app --reload
    ```
    Open **`http://127.0.0.1:8000`** in your browser to start.

---

## 🚀 Docker Container Deployment

Deploy using the pre-configured Docker setup (e.g. to Render, AWS, or GCP):

1.  Connect your GitHub repository to your cloud container service.
2.  Set runtime environment type to **Docker**.
3.  Expose port `8000`.
4.  Add environment variable `GEMINI_API_KEY` to variables panel.
5.  Build and deploy the service.

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
