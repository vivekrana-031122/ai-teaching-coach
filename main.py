import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import google.generativeai as genai
import httpx
from dotenv import load_dotenv

# Load local environment variables for development
load_dotenv()

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI(title="AI Teaching Coach - Agent 1")

# System instruction for the Gemini Model
SYSTEM_INSTRUCTION = """
You are "Agent 1", a patient, expert coding teacher who teaches me (a complete beginner) concepts and code from my own GitHub repositories and daily LEARNING_LOG.md entries.

CORE TEACHING RULES (MUST FOLLOW STRICTLY):
1. LANGUAGE: Natural Hinglish — the way people actually talk day to day in India, mixing Hindi and English fluidly. Do NOT use textbook-formal Hindi. Do NOT use pure English. Write like a smart, friendly peer explaining something. Example: "Pehle toh hum variables ko initialize karenge, fir loop chalayenge."
2. GRANULARITY: Break everything into very small chunks. For code, go line-by-line when explaining. Never dump a wall of text. Focus on what a line does, why it is written that way, and what would break or go wrong without it.
3. ANALOGIES BEFORE JARGON: Introduce every technical concept with a simple, real-world analogy first (e.g. an API is like a restaurant waiter carrying orders, a database connection wrapper is like a translation layer between two languages). Connect it to the technical terms ONLY after the analogy is clear.
4. CHECK UNDERSTANDING CONSTANTLY: After explaining each small chunk, pause and ask a simple, low-pressure question to check understanding (e.g. "samajh aaya?", "kya lagta hai, clear hua?"). DO NOT continue to the next part until the user responds/confirms.
5. ADAPTIVE RE-EXPLANATION: If the user says they are confused or gets something wrong, NEVER repeat the same explanation. Use a completely different analogy, visual, or angle.
6. ACTIVE RECALL CLOSE: End every teaching session by asking the user to explain the core concept back to you in their own words. This is the final verification step.
7. NO EGO: Always encourage the user. Treat every question as reasonable. Never be patronizing or condescending. Keep it engaging and friendly!
"""

class ChatMessage(BaseModel):
    role: str # "user" or "model"
    parts: List[str]

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage]

class RepoFileRequest(BaseModel):
    repo: str
    path: str

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured in the environment variables.")
        
    try:
        # Load the Gemini Model with System Instructions
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=SYSTEM_INSTRUCTION
        )
        
        # Convert request history format to Gemini SDK format
        # Gemini SDK expects: [{'role': 'user', 'parts': ['...']}, {'role': 'model', 'parts': ['...']}]
        gemini_history = []
        for msg in request.history:
            gemini_history.append({
                "role": msg.role,
                "parts": msg.parts
            })
            
        # Start a chat session with the loaded history
        chat = model.start_chat(history=gemini_history)
        
        # Send the user's message and get response
        response = chat.send_message(request.message)
        return {"response": response.text}
        
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to communicate with Gemini: {str(e)}")

@app.post("/api/starter-log")
async def fetch_starter_log():
    # Automatically fetch the daily learning log from GitHub
    url = "https://raw.githubusercontent.com/vivekrana-031122/vivekrana-031122/main/LEARNING_LOG.md"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Failed to fetch LEARNING_LOG.md from GitHub.")
                
            content = resp.text
            
            # Simple parser to find the most recent entry in LEARNING_LOG.md
            # Learning logs start with "## 📅 YYYY-MM-DD"
            matches = re.split(r"## 📅", content)
            if len(matches) < 2:
                # Fallback to returning the entire file if parser fails
                return {"log_content": content}
                
            # The first block after splitting is the file header. The second block is the latest entry.
            latest_entry = "## 📅" + matches[1].strip()
            return {"log_content": latest_entry}
            
    except Exception as e:
        print(f"Error fetching learning log: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving learning log: {str(e)}")

@app.post("/api/fetch-repo-file")
async def fetch_repo_file(request: RepoFileRequest):
    # Fetch a specific file from a public repo
    url = f"https://raw.githubusercontent.com/vivekrana-031122/{request.repo}/main/{request.path}"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10)
            if resp.status_code == 404:
                # Try master branch if main branch fails (older repos)
                alt_url = f"https://raw.githubusercontent.com/vivekrana-031122/{request.repo}/master/{request.path}"
                resp = await client.get(alt_url, timeout=10)
                
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=f"File {request.path} not found in repo {request.repo}.")
                
            return {"content": resp.text}
    except Exception as e:
        print(f"Error fetching repo file: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving file content: {str(e)}")

# Regex import is required for starter-log parser
import re

# Mount static files to serve frontend
app.mount("/", StaticFiles(directory="static", html=True), name="static")
