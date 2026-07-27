let serverUrl = localStorage.getItem("jarvus_server_url") || "https://ai-teaching-coach.onrender.com";
const iframe = document.getElementById("chat-frame");
const urlInput = document.getElementById("server-url");
const saveBtn = document.getElementById("save-btn");

urlInput.value = serverUrl;
iframe.src = serverUrl;

saveBtn.addEventListener("click", () => {
    const val = urlInput.value.trim();
    if (val) {
        serverUrl = val;
        localStorage.setItem("jarvus_server_url", serverUrl);
        iframe.src = serverUrl;
        alert("Jarvus server address updated!");
    }
});

// Extract context
function sendTabContext() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].url) {
            const match = tabs[0].url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
            if (match) {
                const repo = match[2];
                const path = match[4];
                
                // Send event to iframe
                iframe.contentWindow.postMessage({
                    action: "current_file",
                    repo: repo,
                    path: path
                }, "*");
            }
        }
    });
}

// Listen to messages from background/tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        sendTabContext();
    }
});

iframe.addEventListener("load", () => {
    sendTabContext();
});
