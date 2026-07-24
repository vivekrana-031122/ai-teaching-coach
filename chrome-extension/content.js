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
    floatBtn.title = "Ask Jarvus";
    floatBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/>
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
