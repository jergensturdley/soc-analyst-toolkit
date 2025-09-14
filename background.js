 // Global variables
let socSettings = {
  autoAnalyze: true,
  contextMenu: true,
  installedDate: new Date().toISOString()
};
let pendingAnalysis = null;
let floatingWindow = null;

// Installation handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings on first install
    const socSettings = {
      autoAnalyze: true,
      contextMenu: true,
      installedDate: new Date().toISOString()
    };
    chrome.storage.local.set({ socSettings });
  }
});

// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'analyze-selection',
    title: 'Analyze with SOC Toolkit',
    contexts: ['selection']
  });
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'analyze-selection') {
    // Store the selected text for analysis
    pendingAnalysis = info.selectionText;
    chrome.storage.local.set({ pendingAnalysis });

    // Open popup or floating window
    chrome.action.openPopup();
  }
});

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPendingAnalysis') {
    chrome.storage.local.get(['pendingAnalysis'], (result) => {
      sendResponse({ text: result.pendingAnalysis || null });
      // Clear pending analysis after retrieval
      chrome.storage.local.remove(['pendingAnalysis']);
    });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'toggleFloat') {
    handleFloatingWindow(sendResponse);
    return true; // Keep message channel open for async response
  }

  if (request.action === 'openInNewTab') {
    chrome.tabs.create({
      url: request.url
    });
  }

  if (request.action === 'updateBadge') {
    const count = request.count || 0;
    chrome.action.setBadgeText({ text: count.toString() });
    // Clear badge after 5 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 5000);
  }
});

// Floating window management
async function handleFloatingWindow(sendResponse) {
  try {
    // Close existing floating window if it exists
    if (floatingWindow) {
      await chrome.windows.remove(floatingWindow.id);
      floatingWindow = null;
    }

    // Create new floating window
    const window = await chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: 440,
      height: 620,
      left: 100,
      top: 100,
      focused: true
    });

    floatingWindow = window;
    sendResponse({ success: true, windowId: window.id });
  } catch (error) {
    console.error('Error creating floating window:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Window closed handler
chrome.windows.onRemoved.addListener((windowId) => {
  if (floatingWindow && floatingWindow.id === windowId) {
    floatingWindow = null;
  }
});

// Keyboard shortcut handler
chrome.commands.onCommand.addListener((command) => {
  if (command === '_execute_action') {
    // Handle keyboard shortcut
    chrome.action.openPopup();
  } else if (command === 'toggle-snippets') {
    // Toggle snippet expansion in active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleSnippets' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Snippet toggle failed:', chrome.runtime.lastError.message);
          }
        });
      }
    });
  }
});

// Badge setup
chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });