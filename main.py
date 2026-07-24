import os
from fastapi import FastAPI, HTTPException, Header, Depends, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import google.generativeai as genai
import httpx
from dotenv import load_dotenv
import re
import secrets
import time
import json

# Load local environment variables for development
load_dotenv()

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI(title="AI Teaching Coach - Jarvus")

# Security states
FAILED_ATTEMPTS = {}  # IP -> {"count": int, "lockout_until": float}
ACTIVE_SESSIONS = {}  # Token -> expiration_timestamp

ACCESS_PASSCODE = os.getenv("ACCESS_PASSCODE")
if not ACCESS_PASSCODE:
    # Generate a random passcode for safe fallback
    ACCESS_PASSCODE = secrets.token_hex(16)
    print("WARNING: ACCESS_PASSCODE environment variable is not set!")
    print(f"Generated secure temporary passcode for this session: {ACCESS_PASSCODE}")

async def verify_session(x_session_token: Optional[str] = Header(None)):
    if not x_session_token:
        raise HTTPException(status_code=401, detail="Session token missing.")
    
    exp_time = ACTIVE_SESSIONS.get(x_session_token)
    if not exp_time or time.time() > exp_time:
        if x_session_token in ACTIVE_SESSIONS:
            del ACTIVE_SESSIONS[x_session_token]
        raise HTTPException(status_code=401, detail="Session expired or invalid.")

class LoginRequest(BaseModel):
    passcode: str

@app.post("/api/login")
async def login_endpoint(request: Request, login_data: LoginRequest):
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()
    
    ip_info = FAILED_ATTEMPTS.get(client_ip, {"count": 0, "lockout_until": 0.0})
    if now < ip_info["lockout_until"]:
        retry_after = int(ip_info["lockout_until"] - now)
        raise HTTPException(
            status_code=403,
            detail=f"Too many failed attempts. Locked out. Try again in {retry_after} seconds."
        )
        
    if login_data.passcode == ACCESS_PASSCODE:
        # Success - Reset lockout counters
        FAILED_ATTEMPTS[client_ip] = {"count": 0, "lockout_until": 0.0}
        # Issue a session token valid for 1 hour
        session_token = secrets.token_hex(24)
        ACTIVE_SESSIONS[session_token] = time.time() + 3600
        return {"session_token": session_token}
    else:
        # Failure
        count = ip_info["count"] + 1
        lockout_until = 0.0
        if count >= 5:
            lockout_until = time.time() + 300  # 5 minutes lockout
            detail_msg = "Too many failed attempts. Locked out for 5 minutes."
        else:
            detail_msg = f"Invalid passcode. {5 - count} attempts remaining."
            
        FAILED_ATTEMPTS[client_ip] = {"count": count, "lockout_until": lockout_until}
        raise HTTPException(status_code=401, detail=detail_msg)

# System instruction for the Gemini Model
SYSTEM_INSTRUCTION = """
You are "Jarvus", a patient, expert coding teacher who teaches me (a complete beginner) concepts and code from my own GitHub repositories and daily LEARNING_LOG.md entries.

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
async def chat_endpoint(request: ChatRequest, session: None = Depends(verify_session)):
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured in the environment variables.")
        
    try:
        # Load the Gemini Model with System Instructions
        model = genai.GenerativeModel(
            model_name="gemini-flash-latest",
            system_instruction=SYSTEM_INSTRUCTION
        )
        
        # Convert request history format to Gemini SDK format
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
async def fetch_starter_log(session: None = Depends(verify_session)):
    # Automatically fetch the daily learning log from GitHub
    url = "https://raw.githubusercontent.com/vivekrana-031122/vivekrana-031122/main/LEARNING_LOG.md"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Failed to fetch LEARNING_LOG.md from GitHub.")
                
            content = resp.text
            
            # Simple parser to find the most recent entry in LEARNING_LOG.md
            matches = re.split(r"## 📅", content)
            if len(matches) < 2:
                return {"log_content": content}
                
            latest_entry = "## 📅" + matches[1].strip()
            return {"log_content": latest_entry}
            
    except Exception as e:
        print(f"Error fetching learning log: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving learning log: {str(e)}")

@app.post("/api/fetch-repo-file")
async def fetch_repo_file(request: RepoFileRequest, session: None = Depends(verify_session)):
    # 1. Input validation & sanitization
    if not re.match(r"^[a-zA-Z0-9\-_]+$", request.repo):
        raise HTTPException(status_code=400, detail="Invalid repository name format.")
        
    if ".." in request.path or request.path.startswith("/") or request.path.startswith("\\"):
        raise HTTPException(status_code=400, detail="Invalid file path format.")
        
    # 2. Fetch the specific file from the hardcoded user's repo (cannot access other user repos)
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
            
            # 3. Extract metadata for UI verification
            first_line = ""
            lines = resp.text.splitlines()
            # Find the first non-empty line
            for line in lines:
                if line.strip():
                    first_line = line
                    break
                    
            return {
                "content": resp.text,
                "first_line": first_line,
                "filename": os.path.basename(request.path)
            }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error fetching repo file: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving file content: {str(e)}")

class IntentRequest(BaseModel):
    text: str

@app.post("/api/parse-intent")
async def parse_intent_endpoint(request: IntentRequest, session: None = Depends(verify_session)):
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured.")
        
    prompt = f"""
    You are an intent parser for a developer chatbot named Jarvus.
    Your job is to parse a spoken Hinglish/English sentence and extract the structured intent.
    You must output ONLY a valid JSON object with the following fields:
    - "action": "open_file", "teach_today", or "general_question"
    - "repo": extracted repository name (or null if not mentioned or ambiguous)
    - "file_path": extracted file path/name (or null if not mentioned or ambiguous)
    - "clarification_needed": boolean (true if repo or file_path is mentioned but ambiguous/unclear/requires verification, e.g. "open db helper", "open zepto repo")
    - "clarification_prompt": a friendly spoken Hinglish message asking for clarification (or null if not needed)

    Spoken Sentence: "{request.text}"
    
    Respond with ONLY the JSON object. Do not include markdown formatting tags like ```json.
    """
    
    try:
        model = genai.GenerativeModel(model_name="gemini-flash-latest")
        response = model.generate_content(prompt)
        text_resp = response.text.strip()
        
        # Clean up any markdown code block wrapper if present
        if text_resp.startswith("```"):
            lines = text_resp.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            text_resp = "\n".join(lines).strip()
            
        parsed_json = json.loads(text_resp)
        return parsed_json
    except Exception as e:
        print(f"Error parsing intent: {e}")
        # Fallback to general question on parse failure
        return {
            "action": "general_question",
            "repo": None,
            "file_path": None,
            "clarification_needed": False,
            "clarification_prompt": None
        }

# Mount static files to serve frontend
app.mount("/", StaticFiles(directory="static", html=True), name="static")
