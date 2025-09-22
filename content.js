// Content script for SOC Analyst Toolkit
// This script runs on all web pages to enhance functionality

(function() {
  "use strict";

  // Check if we're already injected
  if (window.socToolkitInjected) return;
  window.socToolkitInjected = true;

  // Global variables for snippet system
  let snippets = [];
  let snippetSystemEnabled = true;

  // Listen for messages from the popup and background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getSelectedText") {
      const selectedText = window.getSelection().toString().trim();
      sendResponse({ text: selectedText });
    }
    if (request.action === "highlightIOCs") {
      highlightIOCsOnPage(request.iocs);
      sendResponse({ success: true });
    }
    if (request.action === "copyToClipboard") {
      copyToClipboard(request.text);
      sendResponse({ success: true });
    }
    if (request.action === "toggleSnippets") {
      toggleSnippetSystem();
      sendResponse({ success: true });
    }
  });

  // Simple snippet system setup
  function setupSnippetSystem() {
    loadSnippetSettings(); // Load user settings
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      // Ctrl+Alt+S: Toggle snippet system
      if (event.ctrlKey && event.altKey && event.key === 's') {
        event.preventDefault();
        toggleSnippetSystem();
      }
      
      // Ctrl+Alt+L: Show snippets list for copying
      if (event.ctrlKey && event.altKey && event.key === 'l') {
        event.preventDefault();
        console.log('SOC Toolkit: Ctrl+Alt+L pressed, showing snippets');
        showSnippetsForCopy();
      }
    }, true);
    
    console.log('SOC Toolkit: Snippet copy system initialized with keyboard shortcuts');
  }

  // Enhanced clipboard functionality
  async function copyToClipboard(text) {
    if (!navigator.clipboard) {
      // Fallback for older browsers
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showPageNotification('📋 Copied to clipboard!', 'success');
      } catch (err) {
        showPageNotification('❌ Failed to copy.', 'error');
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showPageNotification('📋 Copied to clipboard!', 'success');
    } catch (err) {
      console.error('SOC Toolkit: Failed to copy to clipboard:', err);
      showPageNotification('❌ Failed to copy.', 'error');
    }
  }

  function processSnippetContent(content) {
    if (!content) return '';
    
    // Process template variables
    const now = new Date();
    const currentDate = now.toLocaleDateString();
    const currentTime = now.toLocaleTimeString();
    const currentDateTime = now.toLocaleString();
    
    return content
      .replace(/\$\{CURRENT_DATE\}/g, currentDate)
      .replace(/\$\{CURRENT_TIME\}/g, currentTime)
      .replace(/\$\{CURRENT_DATETIME\}/g, currentDateTime)
      .replace(/\$\{YEAR\}/g, now.getFullYear().toString())
      .replace(/\$\{MONTH\}/g, (now.getMonth() + 1).toString().padStart(2, '0'))
      .replace(/\$\{DAY\}/g, now.getDate().toString().padStart(2, '0'));
  }



  // Toggle snippet system
  function toggleSnippetSystem() {
    snippetSystemEnabled = !snippetSystemEnabled;
    
    // Save the setting
    try {
      chrome.storage.local.get(['socSettings'], (result) => {
        const settings = result.socSettings || {};
        settings.snippetSystemEnabled = snippetSystemEnabled;
        chrome.storage.local.set({ socSettings: settings });
      });
    } catch (e) {
      console.warn('SOC Toolkit: Could not save snippet system setting:', e);
    }
    
    const status = snippetSystemEnabled ? "enabled" : "disabled";
    const icon = snippetSystemEnabled ? "✅" : "❌";
    showPageNotification(`${icon} Snippet system ${status}`, snippetSystemEnabled ? 'success' : 'warning');
  }

  // Enhanced page notification with better styling
  function showPageNotification(message, type = 'info', duration = 3000) {
    // Remove any existing notifications
    const existing = document.querySelector('.soc-toolkit-notification');
    if (existing) {
      existing.remove();
    }
    
    const notification = document.createElement("div");
    notification.className = 'soc-toolkit-notification';
    
    let backgroundColor, borderColor;
    switch (type) {
      case 'success':
        backgroundColor = '#065f46';
        borderColor = '#10b981';
        break;
      case 'error':
        backgroundColor = '#7f1d1d';
        borderColor = '#ef4444';
        break;
      case 'warning':
        backgroundColor = '#78350f';
        borderColor = '#f59e0b';
        break;
      default: // info
        backgroundColor = '#1e3a8a';
        borderColor = '#3b82f6';
    }
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${backgroundColor};
      color: #f9fafb;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 2147483647;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
      border-left: 4px solid ${borderColor};
      max-width: 320px;
      word-wrap: break-word;
      transition: all 0.3s ease;
      opacity: 0;
      transform: translateX(100%);
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color: ${borderColor}; font-size: 16px;">🛡️</span>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    });
    
    // Auto-remove after duration
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    }, duration);
  }

  // Load snippet system setting on startup
  function loadSnippetSettings() {
    try {
      chrome.storage.local.get(['socSettings'], (result) => {
        const settings = result.socSettings || {};
        snippetSystemEnabled = settings.snippetSystemEnabled !== false; // default to true
      });
    } catch (e) {
      console.warn('SOC Toolkit: Could not load snippet settings:', e);
      snippetSystemEnabled = true; // default to enabled
    }
  }

  // Show available snippets for copying
  function showSnippetsForCopy() {
    if (!snippetSystemEnabled) {
      showPageNotification("❌ Snippet system is disabled. Press Ctrl+Alt+S to enable.", 'warning', 4000);
      return;
    }

    try {
      chrome.storage.local.get(['snippets'], (result) => {
        const loadedSnippets = result.snippets || [];
        
        if (loadedSnippets.length === 0) {
          showPageNotification("📝 No snippets found. Create some in the SOC Toolkit popup!", 'info', 4000);
          return;
        }
        
        // Remove any existing snippet list
        const existing = document.querySelector('.soc-snippet-list');
        if (existing) {
          existing.remove();
          return; // Toggle off if already showing
        }
        
        const listContainer = document.createElement("div");
        listContainer.className = 'soc-snippet-list';
        listContainer.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #1f2937;
          color: #f9fafb;
          padding: 20px;
          border-radius: 12px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
          font-size: 13px;
          z-index: 2147483647;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
          border: 1px solid #374151;
          max-width: 500px;
          max-height: 400px;
          overflow-y: auto;
          backdrop-filter: blur(8px);
        `;
        
        let content = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #374151; padding-bottom: 12px;">
            <h3 style="margin: 0; color: #10b981; font-size: 16px;">🛡️ Copy Snippets</h3>
            <span style="font-size: 11px; color: #9ca3af;">Ctrl+Alt+L to toggle</span>
          </div>
        `;
        
        loadedSnippets.forEach((snippet, index) => {
          const title = snippet.name || `Snippet ${index + 1}`;
          const preview = (snippet.content || '').substring(0, 60) + (snippet.content && snippet.content.length > 60 ? '...' : '');
          
          content += `
            <div style="margin-bottom: 12px; padding: 8px; background: #374151; border-radius: 6px; border-left: 3px solid #10b981; cursor: pointer; transition: background-color 0.2s;" 
                 onmouseover="this.style.background='#4b5563'" 
                 onmouseout="this.style.background='#374151'"
                 onclick="copySnippetContent(${index})">
              <div style="display: flex; gap: 12px; align-items: flex-start;">
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: #e5e7eb; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                    <span>📋</span>
                    <span>${title}</span>
                  </div>
                  <div style="color: #9ca3af; font-size: 12px; line-height: 1.4;">${preview}</div>
                </div>
              </div>
            </div>
          `;
        });
        
        content += `
          <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #374151; text-align: center; color: #6b7280; font-size: 11px;">
            Click any snippet to copy to clipboard • Press Esc to close
          </div>
        `;
        
        listContainer.innerHTML = content;
        
        // Store snippets in window for onclick handler
        window.socSnippets = loadedSnippets;
        
        // Add global copy function
        window.copySnippetContent = function(index) {
          const snippet = window.socSnippets[index];
          if (snippet && snippet.content) {
            const processedContent = processSnippetContent(snippet.content);
            copyToClipboard(processedContent);
            listContainer.remove();
          }
        };
        
        // Add click-to-close and escape key handler
        listContainer.addEventListener('click', (e) => {
          if (e.target === listContainer) {
            listContainer.remove();
          }
        });
        
        const closeOnEscape = (e) => {
          if (e.key === 'Escape') {
            listContainer.remove();
            document.removeEventListener('keydown', closeOnEscape);
          }
        };
        document.addEventListener('keydown', closeOnEscape);
        
        document.body.appendChild(listContainer);
        
        // Auto-remove after 15 seconds
        setTimeout(() => {
          if (listContainer.parentNode) {
            listContainer.remove();
          }
        }, 15000);
      });
    } catch (e) {
      console.error('SOC Toolkit: Error showing snippets:', e);
      showPageNotification("❌ Error loading snippets", 'error');
    }
  }





  function highlightIOCsOnPage(iocs) {
    showPageNotification(`🔍 IOC highlighting: ${iocs.length} indicators`, 'info');
  }

  function loadSnippets(callback) {
    try {
      chrome.storage.local.get(["snippets"], (result) => {
        snippets = Array.isArray(result.snippets) ? result.snippets : [];
        if (callback) callback();
      });
    } catch (e) {
      console.error("SOC Toolkit: Error loading snippets:", e);
      snippets = [];
      if (callback) callback();
    }
  }

  // Initialize snippet system
  console.log("SOC Toolkit: Initializing snippet copy system");
  loadSnippets(() => {
    console.log("SOC Toolkit: Loaded", snippets.length, "snippets");
    setupSnippetSystem();
  });

})();
