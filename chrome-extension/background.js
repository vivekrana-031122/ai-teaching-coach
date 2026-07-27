// Background Service Worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "open_sidepanel") {
        if (sender.tab && sender.tab.id) {
            chrome.sidePanel.open({ tabId: sender.tab.id });
        }
    }
});

// Command listener for keyboard shortcuts (e.g. Alt+J)
chrome.commands.onCommand.addListener((command) => {
    if (command === "open_side_panel") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
                chrome.sidePanel.open({ tabId: tabs[0].id });
            }
        });
    }
});
