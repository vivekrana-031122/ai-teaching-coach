(function() {
    // Avoid double injection
    if (document.getElementById("jarvus-extension-root")) return;

    const root = document.createElement("div");
    root.id = "jarvus-extension-root";
    document.body.appendChild(root);

    // Default server address
    let serverUrl = localStorage.getItem("jarvus_server_url") || "http://127.0.0.1:8085";

    // 1. Create floating button
    const floatBtn = document.createElement("button");
    floatBtn.className = "jarvus-float-btn";
    floatBtn.innerHTML = `
        <div class="jarvus-tooltip">Chat with Jarvus 🤖</div>
        <svg viewBox="0 0 100 100" style="width: 32px; height: 32px;">
            <circle cx="50" cy="50" r="45" fill="none" stroke="url(#jarvus-grad)" stroke-width="6" />
            <path d="M40 30h20v25c0 8.3-6.7 15-15 15s-15-6.7-15-15h6c0 5 4 9 9 9s9-4 9-9V36H40V30z" fill="url(#jarvus-grad)" />
            <circle cx="43" cy="45" r="4" fill="#00f2fe" />
            <circle cx="57" cy="45" r="4" fill="#00f2fe" />
            <defs>
                <linearGradient id="jarvus-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#a855f7" />
                    <stop offset="100%" stop-color="#06b6d4" />
                </linearGradient>
            </defs>
        </svg>
    `;
    root.appendChild(floatBtn);

    // 2. Create sliding chat panel
    const panel = document.createElement("div");
    panel.className = "jarvus-chat-panel";
    panel.innerHTML = `
        <div class="jarvus-panel-header">
            <div class="jarvus-header-top">
                <h3>🤖 Jarvus Assistant</h3>
                <button class="jarvus-close-btn">&times;</button>
            </div>
            <div class="jarvus-settings-row">
                <input type="text" id="jarvus-server-input" value="${serverUrl}" placeholder="Jarvus Server URL" />
                <button id="jarvus-save-server-btn">Save</button>
            </div>
        </div>
        <div class="jarvus-iframe-container">
            <iframe id="jarvus-chat-iframe" src="${serverUrl}"></iframe>
        </div>
    `;
    root.appendChild(panel);

    const iframe = panel.querySelector("#jarvus-chat-iframe");
    const serverInput = panel.querySelector("#jarvus-server-input");
    const saveBtn = panel.querySelector("#jarvus-save-server-btn");
    const closeBtn = panel.querySelector(".jarvus-close-btn");

    // Close action
    closeBtn.addEventListener("click", () => {
        panel.classList.remove("open");
    });

    // Toggle panel
    floatBtn.addEventListener("click", () => {
        panel.classList.toggle("open");
        if (panel.classList.contains("open")) {
            sendGithubContext();
        }
    });

    // Save server URL settings
    saveBtn.addEventListener("click", () => {
        const value = serverInput.value.trim();
        if (value) {
            serverUrl = value;
            localStorage.setItem("jarvus_server_url", serverUrl);
            iframe.src = serverUrl;
            alert("Jarvus server address updated!");
        }
    });

    // Context extractor: Read current open GitHub code page
    function sendGithubContext() {
        const url = window.location.href;
        // Match github.com/username/repo/blob/branch/file_path
        const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
        
        if (match) {
            const username = match[1];
            const repo = match[2];
            const filePath = match[4];
            
            // Send event to iframe
            iframe.contentWindow.postMessage({
                action: "current_file",
                repo: repo,
                path: filePath,
                username: username
            }, "*");
        }
    }

    // Monitor URL routing changes in SPA environment
    let lastUrl = window.location.href;
    setInterval(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            if (panel.classList.contains("open")) {
                sendGithubContext();
            }
        }
    }, 1000);

})();
