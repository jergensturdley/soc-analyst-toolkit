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
    console.log("SOC Toolkit: Received message", request);
    
    if (request.action === "getSelectedText") {
      const selectedText = window.getSelection().toString().trim();
      sendResponse({ text: selectedText });
    }
    
    if (request.action === "highlightIOCs") {
      highlightIOCsOnPage(request.iocs);
      sendResponse({ success: true });
    }

    if (request.action === "triggerSnippetSearch") {
      console.log("SOC Toolkit: Triggering snippet search");
      triggerSnippetSearchAtCursor();
      sendResponse({ success: true });
    }

    if (request.action === "toggleSnippets") {
      console.log("SOC Toolkit: Toggling snippets");
      toggleSnippetExpansion();
      sendResponse({ success: true });
    }
  });

  // Function to trigger snippet search at cursor position
  function triggerSnippetSearchAtCursor() {
    console.log("SOC Toolkit: Global snippet search triggered");
    showGlobalSnippetOverlay();
  }

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

  function showGlobalSnippetOverlay() {
    if (!snippets.length) {
      showPageNotification("No snippets available");
      return;
    }

    const overlay = createGlobalOverlay();
    const list = overlay.querySelector(".snippet-list");
    
    snippets.slice(0, 20).forEach((snippet, index) => {
      const item = document.createElement("div");
      item.className = "snippet-item";
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid rgba(55,65,81,0.3);
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      
      if (index === 0) item.style.background = "#1e40af";
      
      item.innerHTML = `
        <div>
          <div style="font-weight: bold; color: #3b82f6;">${snippet.trigger || ""}</div>
          <div style="font-size: 12px; color: #9ca3af;">${snippet.name || ""}</div>
        </div>
        <div style="font-size: 11px; color: #6b7280; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">
          ${(snippet.content || "").substring(0, 50)}${snippet.content && snippet.content.length > 50 ? "..." : ""}
        </div>
      `;
      
      item.addEventListener("click", () => {
        copyToClipboard(snippet.content || "");
        showPageNotification(`Copied "${snippet.name}" to clipboard`);
        overlay.remove();
      });
      
      list.appendChild(item);
    });

    // Handle keyboard navigation and cleanup
    let overlaySelectedIndex = 0;
    const handleKeydown = (e) => {
      const items = list.querySelectorAll(".snippet-item");
      
      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[overlaySelectedIndex].style.background = "";
        overlaySelectedIndex = Math.min(items.length - 1, overlaySelectedIndex + 1);
        items[overlaySelectedIndex].style.background = "#1e40af";
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        items[overlaySelectedIndex].style.background = "";
        overlaySelectedIndex = Math.max(0, overlaySelectedIndex - 1);
        items[overlaySelectedIndex].style.background = "#1e40af";
      } else if (e.key === "Enter") {
        e.preventDefault();
        items[overlaySelectedIndex].click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        overlay.remove();
      }
    };

    document.addEventListener("keydown", handleKeydown);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // Cleanup when overlay is removed
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node === overlay) {
            document.removeEventListener("keydown", handleKeydown);
            observer.disconnect();
          }
        });
      });
    });
    observer.observe(document.body, { childList: true });
  }

  function createGlobalOverlay() {
    // Remove existing overlay
    const existing = document.getElementById("soc-global-snippet-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "soc-global-snippet-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      z-index: 2147483647;
      display: flex;
      justify-content: center;
      align-items: center;
    `;

    const container = document.createElement("div");
    container.style.cssText = `
      background: #0b1220;
      color: #e5e7eb;
      border: 1px solid rgba(55,65,81,0.9);
      border-radius: 8px;
      width: 600px;
      max-width: 90vw;
      max-height: 80vh;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    `;

    const header = document.createElement("div");
    header.style.cssText = `
      padding: 16px;
      border-bottom: 1px solid rgba(55,65,81,0.3);
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <span>🛡️ SOC Toolkit Snippets</span>
      <span style="font-size: 12px; color: #9ca3af;">Press Enter to copy, Esc to close</span>
    `;

    const list = document.createElement("div");
    list.className = "snippet-list";
    list.style.cssText = `
      max-height: 400px;
      overflow-y: auto;
    `;

    container.appendChild(header);
    container.appendChild(list);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    return overlay;
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

  // Initialize
  console.log("SOC Analyst Toolkit content script loaded");
})();
