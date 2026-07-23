# AI Teaching Coach ("Agent 1")

AI Teaching Coach ("Agent 1") is an interactive, web-based study assistant designed to teach you code and daily engineering progress from your GitHub repositories and `LEARNING_LOG.md` entries. 

Built using **FastAPI** on the backend and a modern glassmorphism chat interface on the frontend, the agent leverages the **Google Gemini API** to act as a highly patient, expert bilingual peer who explains concepts in fluid **Hinglish** (mixing Hindi and English) rather than formal textbook jargon.

---

## 🛠️ Core Teaching Principles
Agent 1 is programmed to follow strict educational guidelines:
1.  **Natural Hinglish:** Explanations feel like a smart friend talking to you, not a translated dictionary.
2.  **Line-by-Line Breakdown:** Code is analyzed in small, digestible chunks.
3.  **Analogies Before Jargon:** Technical terms are introduced with simple real-world metaphors before introducing the formal vocabulary.
4.  **Constant Understanding Checks:** Pauses after every block and asks simple questions (like *"samajh aaya?"*) to verify understanding before moving forward.
5.  **Active Recall Close:** Every study session ends by prompting you to explain the core concept back in your own words.

---

## 📂 Repository Structure
```
ai-teaching-coach/
├── static/
│   ├── index.html     # Single-page Chat UI
│   ├── style.css      # Dark mode styling (matching GitHub theme)
│   └── app.js         # Frontend network logic & marked/prism configurations
├── main.py            # FastAPI backend API & Gemini SDK integration
├── requirements.txt   # Python dependencies
├── Dockerfile         # Docker multi-stage configuration
├── .gitignore         # File exclusions
└── README.md          # Technical documentation
```

---

## 💻 Local Setup & Execution

### 1. Prerequisites
*   Python 3.11+ installed.
*   A Google Gemini API key from **[Google AI Studio](https://aistudio.google.com/)**.

### 2. Installation Steps
1.  Clone the repository:
    ```bash
    git clone https://github.com/vivekrana-031122/ai-teaching-coach.git
    cd ai-teaching-coach
    ```
2.  Create a virtual environment:
    ```bash
    python -m venv .venv
    # Windows:
    .venv\Scripts\activate
    # macOS/Linux:
    source .venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Create and configure your `.env` file:
    ```bash
    cp .env.example .env
    ```
    Open `.env` and paste your Gemini API key:
    ```env
    GEMINI_API_KEY=AIzaSy...
    ```
5.  Start the FastAPI server:
    ```bash
    python -m uvicorn main:app --reload
    ```
6.  Open your browser and navigate to **`http://127.0.0.1:8000`** to start chatting with Agent 1!

---

## 🚀 Deployment to Render (Docker)
This repository is configured with a Dockerfile for one-click deployment:

1.  Create a new Web Service on **[Render](https://dashboard.render.com)**.
2.  Connect your `ai-teaching-coach` GitHub repository.
3.  Set the **Runtime** to **`Docker`**.
4.  Add an environment variable in Render settings:
    *   **Key:** `GEMINI_API_KEY`
    *   **Value:** *(Your Gemini API Key)*
5.  Click **Deploy Web Service**. Render will build the container and output a public URL!
