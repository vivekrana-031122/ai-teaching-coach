// Application State
let chatHistory = []; // Array of {role: "user"|"model", parts: [string]}
let isVoiceMuted = false;
let currentUtterance = null;
let recognition = null;
let isListening = false;
let selectedLanguage = null;
let approvalPollInterval = null;

// Guest Session token helper
function getOrCreateGuestToken() {
    let guestToken = localStorage.getItem("jarvus_guest_token");
    if (!guestToken) {
        guestToken = "guest_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem("jarvus_guest_token", guestToken);
    }
    return guestToken;
}

// DOM Elements
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const btnStarterLog = document.getElementById("btn-starter-log");
const btnLoadFile = document.getElementById("btn-load-file");
const selectRepo = document.getElementById("select-repo");
const inputFile = document.getElementById("input-file-path");
const activeTopicName = document.getElementById("active-topic-name");
const btnClearChat = document.getElementById("btn-clear-chat");
const suggestionTagsContainer = document.querySelector(".chat-suggestions");

// Voice Elements
const btnVoiceToggle = document.getElementById("btn-voice-toggle");
const voiceIcon = document.getElementById("voice-icon");
const btnMicToggle = document.getElementById("btn-mic-toggle");
const micIcon = document.getElementById("mic-icon");

// Configure marked.js to render code blocks correctly
marked.setOptions({
    breaks: true,
    sanitize: false
});

// Helper: Retrieve active token or prompt user to login
async function getSessionToken() {
    let token = localStorage.getItem("jarvus_session_token");
    if (!token) {
        const passcode = prompt("Enter Jarvus Passcode:");
        if (!passcode) return null;
        token = await loginWithPasscode(passcode);
    }
    return token;
}

// Helper: Call login endpoint and cache token on success
async function loginWithPasscode(passcode) {
    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ passcode })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            alert(`Login failed: ${errData.detail}`);
            return null;
        }
        
        const data = await response.json();
        localStorage.setItem("jarvus_session_token", data.session_token);
        
        // Success! Reload greeting for Owner
        initializeChat();
        return data.session_token;
    } catch (error) {
        alert(`Network error during login: ${error.message}`);
        return null;
    }
}

// Helper: Clear cached token when unauthorized
function handleUnauthorized() {
    localStorage.removeItem("jarvus_session_token");
    alert("Session expired or unauthorized. Please re-enter your passcode.");
    initializeChat();
}

// Helper: Append a message bubble to the chat feed
function appendMessage(role, text) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", role);

    const avatarDiv = document.createElement("div");
    avatarDiv.classList.add("message-avatar");
    avatarDiv.innerHTML = role === "user" ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';

    const contentDiv = document.createElement("div");
    contentDiv.classList.add("message-content");
    
    // Parse markdown content
    contentDiv.innerHTML = marked.parse(text);

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // Scroll chat window to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Trigger Prism.js syntax highlighting for any code blocks
    Prism.highlightAllUnder(contentDiv);

    // If model response and not muted, speak the response out loud
    if (role === "model") {
        speakText(text);
    }
}

// Helper: Show loading indicator
function showLoadingIndicator() {
    const loadingDiv = document.createElement("div");
    loadingDiv.classList.add("message", "model", "loading-indicator");
    loadingDiv.id = "chat-loading";

    const avatarDiv = document.createElement("div");
    avatarDiv.classList.add("message-avatar");
    avatarDiv.innerHTML = '<i class="fa-solid fa-robot"></i>';

    const contentDiv = document.createElement("div");
    contentDiv.classList.add("message-content");
    contentDiv.innerHTML = `
        <div class="typing-dots" style="display: flex; gap: 4px; align-items: center; height: 20px;">
            <span style="color: var(--text-muted); font-size: 13.5px; margin-right: 6px;">Jarvus is typing</span>
            <div class="dot" style="width: 6px; height: 6px; border-radius: 50%; background-color: var(--text-muted); animation: bounce-dot 1.4s infinite ease-in-out both;"></div>
            <div class="dot" style="width: 6px; height: 6px; border-radius: 50%; background-color: var(--text-muted); animation: bounce-dot 1.4s infinite ease-in-out both; animation-delay: 0.16s;"></div>
            <div class="dot" style="width: 6px; height: 6px; border-radius: 50%; background-color: var(--text-muted); animation: bounce-dot 1.4s infinite ease-in-out both; animation-delay: 0.32s;"></div>
        </div>
    `;

    loadingDiv.appendChild(avatarDiv);
    loadingDiv.appendChild(contentDiv);
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Helper: Remove loading indicator
function removeLoadingIndicator() {
    const loadingDiv = document.getElementById("chat-loading");
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// Helper: Speak text out loud using browser native Web Speech API
function speakText(text) {
    if (isVoiceMuted) return;
    
    // Cancel any ongoing speaking
    window.speechSynthesis.cancel();

    // Strip markdown elements, links, and code blocks for spoken voice compatibility
    let speakableText = text.replace(/```[\s\S]*?```/g, "[Code snippet omitted]");
    speakableText = speakableText.replace(/`([^`]+)`/g, "$1");
    speakableText = speakableText.replace(/\*\*([^*]+)\*\*/g, "$1");
    speakableText = speakableText.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    speakableText = speakableText.replace(/<[^>]*>/g, "");

    const utterance = new SpeechSynthesisUtterance(speakableText);
    
    // Prioritize high-quality neural or Google cloud voices for natural speaking cadence
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;
    
    if (voices && voices.length > 0) {
        // Priority 1: Edge Neural Natural Indian Voices
        selectedVoice = voices.find(v => v.name.includes("Natural") && (v.lang.includes("en-IN") || v.lang.includes("hi-IN")));
        
        // Priority 2: Chrome Google Cloud Indian Voices (like Google हिन्दी or Google en-IN)
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.name.includes("Google") && (v.lang.includes("hi-IN") || v.lang.includes("en-IN")));
        }
        
        // Priority 3: Chrome Google Cloud US/UK English (very natural fallback)
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.name.includes("Google") && v.lang.includes("en-"));
        }
        
        // Priority 4: Standard local en-IN or hi-IN
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.includes("en-IN") || v.lang.includes("hi-IN"));
        }
    }
    
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }
    
    utterance.rate = 0.95; // Slightly slower, clean teaching cadence
    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

// API: Send chat history to backend
async function sendChatMessage(userMessageText) {
    showLoadingIndicator();
    
    try {
        const token = localStorage.getItem("jarvus_session_token") || getOrCreateGuestToken();
        
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Session-Token": token
            },
            body: JSON.stringify({
                message: userMessageText,
                history: chatHistory,
                language: selectedLanguage
            })
        });

        if (response.status === 401) {
            removeLoadingIndicator();
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Server error.");
        }

        const data = await response.json();
        removeLoadingIndicator();
        
        // Add to local state history
        chatHistory.push({ role: "user", parts: [userMessageText] });
        chatHistory.push({ role: "model", parts: [data.response] });
        
        // Render response
        appendMessage("model", data.response);

        // Check if Gatekeeper triggered permission flow
        if (data.gatekeeper_triggered) {
            startApprovalPolling(data.repo, data.file_path);
        }

    } catch (error) {
        removeLoadingIndicator();
        appendMessage("model", `⚠️ **Error:** Failed to get response from Coach. Detail: ${error.message}`);
    }
}

// shared API action: Load repo file
async function loadAndTeachFile(repo, path) {
    activeTopicName.innerText = `${repo}/${path}`;
    showLoadingIndicator();
    
    try {
        const token = await getSessionToken();
        if (!token) {
            removeLoadingIndicator();
            return;
        }
        
        const response = await fetch("/api/fetch-repo-file", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Session-Token": token
            },
            body: JSON.stringify({ repo, path })
        });

        if (response.status === 401) {
            removeLoadingIndicator();
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || `Failed to load file content.`);
        }
        
        const data = await response.json();
        removeLoadingIndicator();

        // UI Confirmation: Show filename and first line fetched
        appendMessage("model", `📂 **Successfully fetched from GitHub!**\n* **File:** \`${data.filename}\`\n* **First Line:** \`${data.first_line || "(empty)"}\``);

        // Prepare teaching trigger prompt
        const teachPrompt = `
I want to study the file \`${path}\` in the repository \`${repo}\`. Here is the source code content:

\`\`\`python
${data.content}
\`\`\`

Please start teaching this code to me line-by-line. Focus on what each block/line does, why it is structured that way, and what would fail without it. Introduce key concepts with analogies first, and check my understanding ("samajh aaya?") after each chunk.
`;
        await sendChatMessage(teachPrompt);

    } catch (error) {
        removeLoadingIndicator();
        appendMessage("model", `⚠️ **Error:** Yeh file mujhe nahi mili, path check karo. (${error.message})`);
    }
}

// shared API action: Load starter log
async function loadAndTeachStarterLog() {
    activeTopicName.innerText = "Today's Learning Log";
    showLoadingIndicator();

    try {
        const token = await getSessionToken();
        if (!token) {
            removeLoadingIndicator();
            return;
        }
        
        const response = await fetch("/api/starter-log", { 
            method: "POST",
            headers: {
                "X-Session-Token": token
            }
        });
        
        if (response.status === 401) {
            removeLoadingIndicator();
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Failed to retrieve today's learning log.");
        }
        
        const data = await response.json();
        removeLoadingIndicator();

        const teachPrompt = `
Here is today's LEARNING_LOG.md entry detailing my progress. Please start teaching this content to me step-by-step using natural Hinglish, analogies, and line-by-line code breakdowns where relevant. Make sure to pause and check my understanding after explaining each small chunk.

Here is the log content:
\`\`\`markdown
${data.log_content}
\`\`\`
`;
        await sendChatMessage(teachPrompt);

    } catch (error) {
        removeLoadingIndicator();
        appendMessage("model", `⚠️ **Error:** ${error.message}`);
    }
}

// Unified input processor for voice & manual messages
async function handleSubmission(text) {
    const lowerText = text.toLowerCase().trim();
    // Interceptor local commands
    if (lowerText === "ruko" || lowerText === "stop" || lowerText === "silent" || lowerText === "quiet") {
        window.speechSynthesis.cancel();
        appendMessage("model", "Speech stopped. Aage kya karna hai batao?");
        return;
    }
    
    // Check if lang needs selection
    if (!selectedLanguage && localStorage.getItem("jarvus_session_token") === null) {
        if (["english", "hindi", "hinglish"].includes(lowerText)) {
            selectedLanguage = lowerText;
            appendMessage("model", `Language set to **${text}**! Kaise madad karu aapki? Ask me about Vivek's skills, bio, or summaries of what he has built.`);
            updateSuggestionsForVisitor();
            return;
        }
    }
    
    showLoadingIndicator();
    
    try {
        const token = localStorage.getItem("jarvus_session_token");
        
        // 1. Send text to backend parser to determine structured intent
        const parseResp = await fetch("/api/parse-intent", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "X-Session-Token": token } : {})
            },
            body: JSON.stringify({ text })
        });
        
        if (parseResp.status === 401) {
            removeLoadingIndicator();
            handleUnauthorized();
            return;
        }
        
        if (!parseResp.ok) throw new Error("Intent parsing failed.");
        const parsed = await parseResp.json();
        removeLoadingIndicator();
        
        // 2. Perform action based on parsed intent
        if (parsed.action === "open_file") {
            if (token === null) {
                // Public Visitor asking for code ➡️ Gatekeeper approval flow
                await sendChatMessage(text);
            } else {
                // Owner Mode ➡️ Direct fetch
                if (parsed.clarification_needed) {
                    appendMessage("model", parsed.clarification_prompt);
                } else {
                    await loadAndTeachFile(parsed.repo, parsed.file_path);
                }
            }
        } else if (parsed.action === "teach_today") {
            if (token === null) {
                appendMessage("model", "⚠️ **Access Denied:** Starter log access require Owner permissions. Please log in first.");
            } else {
                await loadAndTeachStarterLog();
            }
        } else {
            // general_question
            await sendChatMessage(text);
        }
        
    } catch (error) {
        removeLoadingIndicator();
        console.warn("Intent router fallback to standard chat:", error);
        await sendChatMessage(text);
    }
}

// Polling pipeline for Gatekeeper Mode
function startApprovalPolling(repo, path) {
    if (approvalPollInterval) clearInterval(approvalPollInterval);
    
    approvalPollInterval = setInterval(async () => {
        try {
            const response = await fetch("/api/check-approval", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ repo, path })
            });
            if (response.ok) {
                const data = await response.json();
                if (data.status === "approved") {
                    clearInterval(approvalPollInterval);
                    appendMessage("model", "🎉 **Vivek has approved the request!** Access granted.");
                    
                    // Public visitors can fetch file contents directly after approval!
                    showLoadingIndicator();
                    const fetchResponse = await fetch("/api/fetch-repo-file", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ repo, path })
                    });
                    
                    if (fetchResponse.ok) {
                        const fileData = await fetchResponse.json();
                        removeLoadingIndicator();
                        appendMessage("model", `📂 **Approved code fetched!**\n* **File:** \`${fileData.filename}\`\n* **First Line:** \`${fileData.first_line || "(empty)"}\``);
                        
                        // Start teaching
                        const teachPrompt = `
I want to study the file \`${path}\` in the repository \`${repo}\`. Here is the source code content:

\`\`\`python
${fileData.content}
\`\`\`

Please explain this code summary and guide me through what it does.
`;
                        await sendChatMessage(teachPrompt);
                    } else {
                        removeLoadingIndicator();
                    }
                } else if (data.status === "denied") {
                    clearInterval(approvalPollInterval);
                    appendMessage("model", "❌ **Vivek has denied the request.** Access refused.");
                }
            }
        } catch (e) {
            console.error("Error polling approval:", e);
        }
    }, 5000);
}

// Initial Greeting setup
async function initializeChat() {
    chatHistory = [];
    chatMessages.innerHTML = "";
    
    let ownerToken = localStorage.getItem("jarvus_session_token");
    if (ownerToken) {
        try {
            const response = await fetch("/api/verify-session", {
                method: "POST",
                headers: {
                    "X-Session-Token": ownerToken
                }
            });
            if (response.ok) {
                // Owner greeting - greet Vivek in Hinglish
                appendMessage("model", "Kya haal hai Vivek! Aaj kya karna hai?");
                activeTopicName.innerText = "No Active Topic";
                updateSuggestionsForOwner();
                return;
            }
        } catch (e) {
            console.error("Owner session validation failed:", e);
        }
    }
    
    // Prompt for passcode to unlock Owner Mode
    const passcode = prompt("Enter Jarvus Passcode to unlock Owner Mode (Cancel for Public Mode):");
    if (passcode) {
        const token = await loginWithPasscode(passcode);
        if (token) {
            // loginWithPasscode calls initializeChat() on success, which will re-run and show the Vivek greeting
            return;
        }
    }
    
    // If validation fails or no token: Public Visitor greeting
    localStorage.removeItem("jarvus_session_token");
    selectedLanguage = null;
    appendMessage("model", "Hello! Vivek's Bilingual Assistant (Jarvus) here. Please pick your preferred language to start: **English**, **Hindi**, or **Hinglish**.");
    activeTopicName.innerText = "Public Visitor Session";
    updateSuggestionsForLanguages();
}

function updateSuggestionsForLanguages() {
    suggestionTagsContainer.innerHTML = `
        <button class="suggestion-tag" data-msg="English">English</button>
        <button class="suggestion-tag" data-msg="Hindi">Hindi</button>
        <button class="suggestion-tag" data-msg="Hinglish">Hinglish</button>
    `;
    hookSuggestionClicks();
}

function updateSuggestionsForVisitor() {
    suggestionTagsContainer.innerHTML = `
        <button class="suggestion-tag" data-msg="Tell me about Vivek's background.">About Vivek</button>
        <button class="suggestion-tag" data-msg="What projects has Vivek built?">Summarize Projects</button>
        <button class="suggestion-tag" data-msg="What ML/AI skills does Vivek have?">Skills & Tech Stack</button>
    `;
    hookSuggestionClicks();
}

function updateSuggestionsForOwner() {
    suggestionTagsContainer.innerHTML = `
        <button class="suggestion-tag" data-msg="Explain db_helper.py's fallback logic.">Explain SQLite Fallback</button>
        <button class="suggestion-tag" data-msg="Jarvus, report do">Live Build Status Report</button>
        <button class="suggestion-tag" data-msg="security check log kya hai?">Check Security logs</button>
    `;
    hookSuggestionClicks();
}

function hookSuggestionClicks() {
    const tags = document.querySelectorAll(".suggestion-tag");
    tags.forEach(tag => {
        tag.addEventListener("click", async () => {
            const query = tag.getAttribute("data-msg");
            appendMessage("user", query);
            await handleSubmission(query);
        });
    });
}

// Event: Submit Chat Form
chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userText = chatInput.value.trim();
    if (!userText) return;

    chatInput.value = "";
    appendMessage("user", userText);
    await handleSubmission(userText);
});

// Event: Click Starter Log Button
btnStarterLog.addEventListener("click", () => {
    loadAndTeachStarterLog();
});

// Event: Click Load File Button
btnLoadFile.addEventListener("click", () => {
    const repo = selectRepo.value;
    const path = inputFile.value.trim();
    if (path) {
        loadAndTeachFile(repo, path);
    }
});

// Event: Click Mute/Unmute voice toggle
btnVoiceToggle.addEventListener("click", () => {
    isVoiceMuted = !isVoiceMuted;
    if (isVoiceMuted) {
        window.speechSynthesis.cancel();
        voiceIcon.className = "fa-solid fa-volume-xmark";
        btnVoiceToggle.title = "Unmute Voice";
    } else {
        voiceIcon.className = "fa-solid fa-volume-high";
        btnVoiceToggle.title = "Mute Voice";
        speakText("Voice enabled! Main bolna shuru kar raha hoon.");
    }
});

// Speech Recognition Configuration
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "hi-IN"; // Set lang to Hindi Indian for Hinglish phonetics
    recognition.interimResults = false;
    
    recognition.onstart = () => {
        isListening = true;
        btnMicToggle.classList.add("active");
        micIcon.className = "fa-solid fa-microphone-lines";
        chatInput.placeholder = "Listening (speak Hinglish)...";
    };
    
    recognition.onend = () => {
        isListening = false;
        btnMicToggle.classList.remove("active");
        micIcon.className = "fa-solid fa-microphone";
        chatInput.placeholder = "Ask anything about your code...";
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        if (transcript) {
            chatInput.value = transcript;
            startVoiceAutoSend(transcript);
        }
    };
    
    recognition.onerror = (event) => {
        console.error("Speech Recognition error:", event.error);
        if (event.error === "not-allowed") {
            appendMessage("model", "⚠️ **Microphone Access Denied:** Chrome side panel me microphone request block ho gayi hai. Is class tab (extension pane) ke left side me address bar me lock icon par click karke microphone allow kijiye, aur manifest permission confirm kijiye.");
        } else {
            appendMessage("model", `⚠️ **Speech Recognition Error:** ${event.error}`);
        }
    };
}

let autoSendInterval = null;
function startVoiceAutoSend(text) {
    let timeLeft = 1.5;
    chatInput.disabled = true;
    chatInput.style.opacity = "0.7";
    
    autoSendInterval = setInterval(async () => {
        timeLeft -= 0.5;
        if (timeLeft <= 0) {
            clearInterval(autoSendInterval);
            chatInput.disabled = false;
            chatInput.style.opacity = "1";
            chatInput.value = "";
            appendMessage("user", text);
            await handleSubmission(text);
        }
    }, 500);
    
    const abortAutoSend = () => {
        clearInterval(autoSendInterval);
        chatInput.disabled = false;
        chatInput.style.opacity = "1";
    };
    chatInput.addEventListener("keydown", abortAutoSend, { once: true });
    chatInput.addEventListener("mousedown", abortAutoSend, { once: true });
}

// Event: Click mic button
btnMicToggle.addEventListener("click", () => {
    if (!recognition) {
        alert("Web Speech recognition is not supported in this browser. Please open in Chrome or Edge.");
        return;
    }
    if (isListening) {
        recognition.stop();
    } else {
        window.speechSynthesis.cancel(); // Stop talking when listening
        recognition.start();
    }
});

// Event: Clear Conversation
btnClearChat.addEventListener("click", () => {
    initializeChat();
});

// Listener: Receive parent window postMessage context from Chrome Extension
let lastDetectedFile = null;
window.addEventListener("message", async (event) => {
    if (event.data && event.data.action === "current_file") {
        const { repo, path } = event.data;
        const fileKey = `${repo}/${path}`;
        
        if (lastDetectedFile === fileKey) return;
        lastDetectedFile = fileKey;
        
        // Append visual helper invitation card in chat feed
        const cardDiv = document.createElement("div");
        cardDiv.className = "message model";
        cardDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fa-solid fa-robot"></i>
            </div>
            <div class="message-content" style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3);">
                <p style="margin: 0 0 6px 0; font-weight: bold; color: #a855f7;">🔍 GitHub Code View Detected!</p>
                <p style="margin: 0 0 8px 0; font-size: 13px;">Aap GitHub par <code>${repo}/${path}</code> dekh rahe hain. Kya is file ko study karna hai?</p>
                <button id="btn-quick-study" class="suggestion-tag" style="background-color: var(--primary); color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-size: 12px; font-weight: 500;">
                    🚀 Load & Teach this File
                </button>
            </div>
        `;
        chatMessages.appendChild(cardDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        cardDiv.querySelector("#btn-quick-study").addEventListener("click", async () => {
            cardDiv.remove();
            appendMessage("user", `Study detected file: \`${path}\` from \`${repo}\``);
            
            const token = localStorage.getItem("jarvus_session_token");
            if (token === null) {
                // Public visitor asks for code ➡️ Gatekeeper mode
                await handleSubmission(`Jarvus, ${repo} repo mein ${path} kholo aur samjhao`);
            } else {
                // Owner ➡️ load and study directly
                await loadAndTeachFile(repo, path);
            }
        });
    }
});

// Run greeting on page load
initializeChat();
