// Content script for SOC Analyst Toolkit
// This script runs on all web pages to enhance functionality

(function() {
  "use strict";

  // Check if we're already injected
  if (window.socToolkitInjected) return;
  window.socToolkitInjected = true;

  // Global variables for snippet system
  let snippets = [];
  let prefixes = ["$"];
  let snippetExpansionEnabled = true;
  let activeInput = null;
  let suggestionBox = null;
  let selectedIndex = -1;
  const SUGGESTION_ID = "soctoolkit-snippet-suggestions";

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
  });



  // Show a temporary notification on the page
  function showPageNotification(message) {
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1f2937;
      color: #f9fafb;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border-left: 4px solid #3b82f6;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color: #3b82f6;">🛡️</span>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  // Toggle snippet expansion
  function toggleSnippetExpansion() {
    snippetExpansionEnabled = !snippetExpansionEnabled;
    showPageNotification(
      snippetExpansionEnabled 
        ? "🛡️ Snippet expansion enabled" 
        : "🛡️ Snippet expansion disabled"
    );
  }





  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      // Fallback method
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  function highlightIOCsOnPage(iocs) {
    showPageNotification(`IOC highlighting: ${iocs.length} indicators`);
  }

  function loadSnippetsAndPrefixes(cb) {
    try {
      chrome.storage.local.get(["snippets","socSettings"], (res) => {
        snippets = Array.isArray(res.snippets) ? res.snippets : [];
        const s = res.socSettings || {};
        prefixes = Array.isArray(s.snippetPrefixes) ? s.snippetPrefixes : ["$"];
        if (cb) cb();
      });
    } catch (e) {
      console.error("SOC Toolkit: Error loading snippets:", e);
      snippets = [];
      prefixes = ["$"];
      if (cb) cb();
    }
  }

    // Initialize snippet system
  console.log("SOC Toolkit: Initializing snippet system");
  loadSnippetsAndPrefixes(() => {
    console.log("SOC Toolkit: Loaded", snippets.length, "snippets with prefixes:", prefixes);
  });

  // Clipboard functionality
  function copyToClipboard(text) {
    try {
      // Create a temporary textarea element
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.top = '-1000px';
      document.body.appendChild(textarea);
      
      // Select and copy
      textarea.select();
      textarea.setSelectionRange(0, 99999); // For mobile devices
      document.execCommand('copy');
      
      // Clean up
      document.body.removeChild(textarea);
      
      console.log('SOC Toolkit: Text copied to clipboard successfully');
    } catch (error) {
      console.error('SOC Toolkit: Failed to copy to clipboard:', error);
      
      // Fallback: try navigator.clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(err => {
          console.error('SOC Toolkit: Clipboard API also failed:', err);
        });
      }
    }
  }

})();
