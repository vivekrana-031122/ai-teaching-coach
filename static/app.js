// Application State
let chatHistory = []; // Array of {role: "user"|"model", parts: [string]}
let isVoiceMuted = true;
let currentUtterance = null;
let recognition = null;
let isListening = false;

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
const suggestionTags = document.querySelectorAll(".suggestion-tag");

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
    contentDiv.innerHTML = `<p style="color: var(--text-muted);"><i class="fa-solid fa-circle-notch fa-spin"></i> Jarvus is typing...</p>`;

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
    
    // Try to load Indian English voice lang or Hindi lang
    const voices = window.speechSynthesis.getVoices();
    const voiceIN = voices.find(v => v.lang.includes("en-IN") || v.lang.includes("hi-IN"));
    if (voiceIN) {
        utterance.voice = voiceIN;
    }
    
    utterance.rate = 0.95; // Slightly slower, clean teaching cadence
    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

// API: Send chat history to backend
async function sendChatMessage(userMessageText) {
    showLoadingIndicator();
    
    try {
        const token = await getSessionToken();
        if (!token) {
            removeLoadingIndicator();
            return;
        }
        
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Session-Token": token
            },
            body: JSON.stringify({
                message: userMessageText,
                history: chatHistory
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
        
        // Render response (triggers speakText internally)
        appendMessage("model", data.response);

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
    
    showLoadingIndicator();
    
    try {
        const token = await getSessionToken();
        if (!token) {
            removeLoadingIndicator();
            return;
        }
        
        // 1. Send text to backend parser to determine structured intent
        const parseResp = await fetch("/api/parse-intent", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Session-Token": token
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
            if (parsed.clarification_needed) {
                appendMessage("model", parsed.clarification_prompt);
            } else {
                await loadAndTeachFile(parsed.repo, parsed.file_path);
            }
        } else if (parsed.action === "teach_today") {
            await loadAndTeachStarterLog();
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
    
    // Allow aborting auto-send if user starts typing or clicks inside input
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
    chatHistory = [];
    chatMessages.innerHTML = `
        <div class="message model">
            <div class="message-avatar">
                <i class="fa-solid fa-robot"></i>
            </div>
            <div class="message-content">
                <p>Chat cleared! Kahan se start karna hai batao? Kisi file ko study karna hai ya daily log updates ko?</p>
            </div>
        </div>
    `;
    activeTopicName.innerText = "No Active Topic";
});

// Event: Suggestion Tag Clicks
suggestionTags.forEach(tag => {
    tag.addEventListener("click", async () => {
        const query = tag.getAttribute("data-msg");
        appendMessage("user", query);
        await handleSubmission(query);
    });
});
