// Application State
let chatHistory = []; // Array of {role: "user"|"model", parts: [string]}

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
        
        // Render response
        appendMessage("model", data.response);

    } catch (error) {
        removeLoadingIndicator();
        appendMessage("model", `⚠️ **Error:** Failed to get response from Coach. Detail: ${error.message}`);
    }
}

// Event: Submit Chat Form
chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userText = chatInput.value.trim();
    if (!userText) return;

    chatInput.value = "";
    appendMessage("user", userText);
    await sendChatMessage(userText);
});

// Event: Click Starter Log Button
btnStarterLog.addEventListener("click", async () => {
    activeTopicName.innerText = "Today's Learning Log";
    appendMessage("user", "Teach me today's update!");
    showLoadingIndicator();

    try {
        const token = await getSessionToken();
        if (!token) {
            removeLoadingIndicator();
            return;
        }
        // 1. Fetch latest learning log entry from backend
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
            throw new Error(errData.detail || "Failed to retrieve today's learning log from GitHub.");
        }
        
        const data = await response.json();
        removeLoadingIndicator();

        // 2. Prepare prompt to start teaching
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
});

// Event: Click Load File Button
btnLoadFile.addEventListener("click", async () => {
    const repo = selectRepo.value;
    const path = inputFile.value.trim();
    if (!path) return;

    activeTopicName.innerText = `${repo}/${path}`;
    appendMessage("user", `Study setup: Load \`${path}\` from \`${repo}\``);
    showLoadingIndicator();

    try {
        const token = await getSessionToken();
        if (!token) {
            removeLoadingIndicator();
            return;
        }
        // 1. Fetch file content from backend
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
            throw new Error(errData.detail || `Failed to load file content for ${path}.`);
        }
        
        const data = await response.json();
        removeLoadingIndicator();

        // UI Confirmation: Show filename and first line fetched!
        appendMessage("model", `📂 **Successfully fetched from GitHub!**\n* **File:** \`${data.filename}\`\n* **First Line:** \`${data.first_line || "(empty)"}\``);

        // 2. Prepare prompt for teaching the code file
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
        await sendChatMessage(query);
    });
});
