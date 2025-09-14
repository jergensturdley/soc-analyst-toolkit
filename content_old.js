// Content script for SOC Analyst Toolkit
// This script runs on all web pages to enhance functionality

(function() {
  'use strict';

  // Check if we're already injected
  if (window.socToolkitInjected) return;
  window.socToolkitInjected = true;

  // Global variables for snippet system
  let snippets = [];
  let prefixes = ['$'];
  let snippetExpansionEnabled = true;
  let activeInput = null;
  let suggestionBox = null;
  let selectedIndex = -1;

  // Listen for messages from the popup and background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSelectedText') {
      const selectedText = window.getSelection().toString().trim();
      sendResponse({ text: selectedText });
    }
    
    if (request.action === 'highlightIOCs') {
      highlightIOCsOnPage(request.iocs);
      sendResponse({ success: true });
    }

    if (request.action === 'triggerSnippetSearch') {
      triggerSnippetSearchAtCursor();
      sendResponse({ success: true });
    }

    if (request.action === 'toggleSnippets') {
      toggleSnippetExpansion();
      sendResponse({ success: true });
    }
  });

  // Function to highlight IOCs on the current page
  function highlightIOCsOnPage(iocs) {
    if (!iocs || iocs.length === 0) return;

    // Create a style element for highlighting
    const style = document.createElement('style');
    style.id = 'soc-toolkit-highlights';
    style.textContent = `
      .soc-highlight {
        background-color: #fef3c7 !important;
        border: 1px solid #f59e0b !important;
        border-radius: 2px !important;
        padding: 1px 2px !important;
        font-weight: bold !important;
      }
      .soc-highlight-ip { border-color: #3b82f6 !important; background-color: #dbeafe !important; }
      .soc-highlight-domain { border-color: #10b981 !important; background-color: #d1fae5 !important; }
      .soc-highlight-url { border-color: #8b5cf6 !important; background-color: #ede9fe !important; }
      .soc-highlight-email { border-color: #f59e0b !important; background-color: #fef3c7 !important; }
      .soc-highlight-hash { border-color: #ef4444 !important; background-color: #fee2e2 !important; }
    `;
    
    // Remove existing highlights
    const existingStyle = document.getElementById('soc-toolkit-highlights');
    if (existingStyle) existingStyle.remove();
    
    document.head.appendChild(style);

    // Get all text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip script and style elements
          const parent = node.parentElement;
          if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    // Highlight IOCs in text nodes
    textNodes.forEach(textNode => {
      let text = textNode.textContent;
      let hasMatches = false;
      
      iocs.forEach(ioc => {
        const regex = new RegExp(escapeRegExp(ioc.value), 'gi');
        if (regex.test(text)) {
          hasMatches = true;
          text = text.replace(regex, `<span class="soc-highlight soc-highlight-${ioc.category}" title="IOC: ${ioc.type}">$&</span>`);
        }
      });

      if (hasMatches) {
        const wrapper = document.createElement('span');
        wrapper.innerHTML = text;
        textNode.parentNode.replaceChild(wrapper, textNode);
      }
    });

    // Show notification
    showPageNotification(`Highlighted ${iocs.length} IOCs on this page`);
  }

  // Utility function to escape regex special characters
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Show a temporary notification on the page
  function showPageNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1f2937;
      color: #f9fafb;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border-left: 4px solid #3b82f6;
      animation: slideInRight 0.3s ease;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color: #3b82f6;">🛡️</span>
        <span>${message}</span>
      </div>
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideInRight 0.3s ease reverse';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        if (style.parentNode) {
          style.parentNode.removeChild(style);
        }
      }, 300);
    }, 3000);
  }

  // Auto-detect and highlight IOCs on page load (optional feature)
  function autoDetectIOCs() {
    // This could be enabled via settings
    // For now, we'll keep it disabled to avoid performance issues
  }

  // ------------------ Global snippet controls ------------------

  function triggerSnippetSearchAtCursor() {
    const activeEl = document.activeElement;
    if (!activeEl || (!isEditableElement(activeEl))) {
      // Show global snippet overlay if no active editable element
      showGlobalSnippetOverlay();
      return;
    }

    // Force show suggestions for current input
    const { token, tokenStart } = getTokenLeft(activeEl);
    const matches = filterMatches(token || '');
    if (matches.length > 0) {
      renderMatches(matches, activeEl, tokenStart);
    } else {
      // Show all snippets if no token match
      renderMatches(snippets.slice(0, 10), activeEl, tokenStart);
    }
  }

  function toggleSnippetExpansion() {
    snippetExpansionEnabled = !snippetExpansionEnabled;
    showPageNotification(
      snippetExpansionEnabled 
        ? '🛡️ Snippet expansion enabled' 
        : '🛡️ Snippet expansion disabled'
    );
    
    if (!snippetExpansionEnabled) {
      hideSuggestions();
    }
  }

  function isEditableElement(el) {
    return el && (
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'INPUT' ||
      el.isContentEditable ||
      el.getAttribute('contenteditable') === 'true'
    );
  }

  function showGlobalSnippetOverlay() {
    if (!snippets.length) {
      showPageNotification('No snippets available');
      return;
    }

    const overlay = createGlobalOverlay();
    const list = overlay.querySelector('.snippet-list');
    
    snippets.slice(0, 20).forEach((snippet, index) => {
      const item = document.createElement('div');
      item.className = 'snippet-item';
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid rgba(55,65,81,0.3);
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      
      if (index === 0) item.classList.add('selected');
      
      item.innerHTML = `
        <div>
          <div style="font-weight: bold; color: #3b82f6;">${snippet.trigger || ''}</div>
          <div style="font-size: 12px; color: #9ca3af;">${snippet.name || ''}</div>
        </div>
        <div style="font-size: 11px; color: #6b7280; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">
          ${(snippet.content || '').substring(0, 50)}${snippet.content && snippet.content.length > 50 ? '...' : ''}
        </div>
      `;
      
      item.addEventListener('click', () => {
        copyToClipboard(snippet.content || '');
        showPageNotification(`Copied "${snippet.name}" to clipboard`);
        overlay.remove();
      });
      
      list.appendChild(item);
    });

    // Handle keyboard navigation
    let selectedIndex = 0;
    const handleKeydown = (e) => {
      const items = list.querySelectorAll('.snippet-item');
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[selectedIndex].classList.remove('selected');
        selectedIndex = Math.min(items.length - 1, selectedIndex + 1);
        items[selectedIndex].classList.add('selected');
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[selectedIndex].classList.remove('selected');
        selectedIndex = Math.max(0, selectedIndex - 1);
        items[selectedIndex].classList.add('selected');
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        items[selectedIndex].click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        overlay.remove();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // Cleanup when overlay is removed
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node === overlay) {
            document.removeEventListener('keydown', handleKeydown);
            observer.disconnect();
          }
        });
      });
    });
    observer.observe(document.body, { childList: true });
  }

  function createGlobalOverlay() {
    // Remove existing overlay
    const existing = document.getElementById('soc-global-snippet-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'soc-global-snippet-overlay';
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

    const container = document.createElement('div');
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

    const header = document.createElement('div');
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

    const list = document.createElement('div');
    list.className = 'snippet-list';
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
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  // ------------------ Snippet suggestions & expansion ------------------
  const SUGGESTION_ID = 'soctoolkit-snippet-suggestions';

  function createSuggestionBox() {
    const existing = document.getElementById(SUGGESTION_ID);
    if (existing) return existing;
    const box = document.createElement('div');
    box.id = SUGGESTION_ID;
    box.style.position = 'absolute';
    box.style.background = '#0b1220';
    box.style.color = '#e5e7eb';
    box.style.border = '1px solid rgba(55,65,81,0.9)';
    box.style.borderRadius = '6px';
    box.style.zIndex = 2147483647;
    box.style.maxHeight = '220px';
    box.style.overflow = 'auto';
    box.style.display = 'none';
    box.style.fontSize = '13px';
    box.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
    document.documentElement.appendChild(box);
    return box;
  }

    function hideSuggestions() {
      if (!suggestionBox) return;
      suggestionBox.style.display = 'none';
      suggestionBox.innerHTML = '';
      selectedIndex = -1;
    }

    function positionBoxFor(el) {
      if (!suggestionBox) return;
      const r = el.getBoundingClientRect();
      suggestionBox.style.left = (window.scrollX + r.left) + 'px';
      suggestionBox.style.top = (window.scrollY + r.bottom + 6) + 'px';
      suggestionBox.style.width = Math.max(200, r.width) + 'px';
    }

    function getTokenLeft(el) {
      try {
        if (el.isContentEditable) {
          const sel = window.getSelection();
          if (!sel || !sel.rangeCount) return { token: '', tokenStartOffset: 0 };
          const range = sel.getRangeAt(0).cloneRange();
          const preRange = range.cloneRange();
          preRange.selectNodeContents(el);
          preRange.setEnd(range.endContainer, range.endOffset);
          const leftText = preRange.toString();
          const m = leftText.match(/(\S+)$/);
          return { token: m ? m[1] : '', tokenStartOffset: m ? leftText.lastIndexOf(m[1]) : 0 };
        } else {
          const pos = el.selectionStart ?? 0;
          const start = Math.max(0, pos - 100);
          const left = el.value.slice(start, pos);
          const m = left.match(/(\S+)$/);
          const token = m ? m[1] : '';
          const tokenStart = start + (m ? left.lastIndexOf(m[1]) : 0);
          return { token, tokenStart, pos };
        }
      } catch (e) {
        return { token: '', tokenStart: 0 };
      }
    }

    function filterMatches(token) {
      if (!token) return [];
      const q = token.toLowerCase();
      return snippets.filter(s => (s.trigger || '').toLowerCase().startsWith(q));
    }

    function applySnippet(s, el, tokenStart) {
      if (!el) return;
      if (el.isContentEditable) {
        // Best-effort: insert text at caret
        document.execCommand('insertText', false, s.content || '');
      } else {
        const value = el.value;
        const before = value.slice(0, tokenStart);
        const after = value.slice(el.selectionStart ?? 0);
        el.value = before + (s.content || '') + after;
        const newPos = (before + (s.content || '')).length;
        el.selectionStart = el.selectionEnd = newPos;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      hideSuggestions();
    }

    function renderMatches(matches, el, tokenStart) {
      if (!suggestionBox) suggestionBox = createSuggestionBox();
      suggestionBox.innerHTML = '';
      matches.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = 'soct-sugg';
        div.style.padding = '8px 10px';
        div.style.cursor = 'pointer';
        div.textContent = `${s.trigger} — ${s.name}`;
        div.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          applySnippet(s, el, tokenStart);
        });
        suggestionBox.appendChild(div);
      });
      positionBoxFor(el);
      suggestionBox.style.display = matches.length ? 'block' : 'none';
      selectedIndex = -1;
    }

    function onInputEvent(e) {
      if (!snippetExpansionEnabled) return;
      
      const el = e.target;
      activeInput = el;
      if (el.type === 'password') return hideSuggestions();
      const { token, tokenStart } = getTokenLeft(el);
      if (!token) return hideSuggestions();
      if (!prefixes.some(p => token.startsWith(p))) return hideSuggestions();
      const matches = filterMatches(token);
      if (!matches.length) return hideSuggestions();
      renderMatches(matches, el, tokenStart);
    }

    function onKeydown(e) {
      if (!snippetExpansionEnabled) return;
      
      if (!suggestionBox || suggestionBox.style.display === 'none') return;
      const items = Array.from(suggestionBox.querySelectorAll('.soct-sugg'));
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(items.length - 1, selectedIndex + 1);
        items.forEach((it, idx) => it.style.background = idx === selectedIndex ? '#0b1220' : '');
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(0, selectedIndex - 1);
        items.forEach((it, idx) => it.style.background = idx === selectedIndex ? '#0b1220' : '');
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const sel = selectedIndex >= 0 ? selectedIndex : 0;
        const text = items[sel].textContent.split(' — ')[0];
        const s = snippets.find(sn => (sn.trigger || '').toLowerCase() === text.toLowerCase() || (sn.trigger || '').toLowerCase().startsWith(text.toLowerCase()));
        if (s) {
          const { tokenStart } = getTokenLeft(activeInput);
          applySnippet(s, activeInput, tokenStart);
        }
      } else if (e.key === 'Escape') {
        hideSuggestions();
      }
    }

    function attachTo(el) {
      if (!el || el._soct_attached) return;
      el._soct_attached = true;
      el.addEventListener('input', onInputEvent);
      el.addEventListener('keydown', onKeydown);
      el.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== el) hideSuggestions(); }, 150));
    }

    function scanAndAttach(root = document) {
      const inputs = Array.from(root.querySelectorAll('input[type=text], input:not([type]), input[type=search], input[type=url], input[type=email], textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]'));
      inputs.forEach(attachTo);
      
      // Also try to attach to any element that might be editable
      const potentialInputs = Array.from(root.querySelectorAll('div, span, p')).filter(el => {
        return el.isContentEditable || 
               el.getAttribute('contenteditable') === 'true' ||
               el.getAttribute('role') === 'textbox' ||
               el.classList.contains('ace_text-input') || // Code editors
               el.classList.contains('monaco-editor') ||
               el.classList.contains('CodeMirror-code');
      });
      potentialInputs.forEach(attachTo);
    }

    function loadSnippetsAndPrefixes(cb) {
      try {
        chrome.storage.local.get(['snippets','socSettings'], (res) => {
          snippets = Array.isArray(res.snippets) ? res.snippets : [];
          const s = res.socSettings || {};
          prefixes = Array.isArray(s.snippetPrefixes) ? s.snippetPrefixes : (s.snippetPrefixes ? s.snippetPrefixes : ['$']);
          if (typeof prefixes === 'string') prefixes = prefixes.split(',').map(p => p.trim()).filter(Boolean);
          if (cb) cb();
        });
      } catch (e) {
        snippets = [];
        prefixes = ['$'];
        if (cb) cb();
      }
    }

    suggestionBox = createSuggestionBox();
    loadSnippetsAndPrefixes(() => {
      scanAndAttach();
      const obs = new MutationObserver(() => { scanAndAttach(document); });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      // Update snippets when storage changes
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.snippets || changes.socSettings) {
          loadSnippetsAndPrefixes(() => {});
        }
      });
    });

  // Initialize snippet system
  suggestionBox = createSuggestionBox();
  loadSnippetsAndPrefixes(() => {
    scanAndAttach();
    const obs = new MutationObserver(() => { scanAndAttach(document); });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    // Update snippets when storage changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.snippets || changes.socSettings) {
        loadSnippetsAndPrefixes(() => {});
      }
    });
  });

  // Initialize
  console.log('SOC Analyst Toolkit content script loaded');
})();