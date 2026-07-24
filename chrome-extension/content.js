(function() {
    // Avoid double injection
    if (document.getElementById("jarvus-extension-root")) return;

    const root = document.createElement("div");
    root.id = "jarvus-extension-root";
    document.body.appendChild(root);

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

    // Trigger native sidepanel on button click
    floatBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "open_sidepanel" });
    });

})();
