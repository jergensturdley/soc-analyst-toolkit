// Content script for SOC Analyst Toolkit// Content script for SOC Analyst Toolkit

// This script runs on all web pages to enhance functionality// This script runs on all web pages to enhance functionality



(function() {(function() {

  'use strict';  'use strict';



  // Check if we're already injected  // Check if we're already injected

  if (window.socToolkitInjected) return;  if (window.socToolkitInjected) return;

  window.socToolkitInjected = true;  window.socToolkitInjected = true;



  // Global variables for snippet system  // Global variables for snippet system

  let snippets = [];  let snippets = [];

  let prefixes = ['$'];  let prefixes = ['$'];

  let snippetExpansionEnabled = true;  let snippetExpansionEnabled = true;

  let activeInput = null;  let activeInput = null;

  let suggestionBox = null;  let suggestionBox = null;

  let selectedIndex = -1;  let selectedIndex = -1;

  const SUGGESTION_ID = 'soctoolkit-snippet-suggestions';  const SUGGESTION_ID = 'soctoolkit-snippet-suggestions';



  // Listen for messages from the popup and background script  // Listen for messages from the popup and background script

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    console.log('SOC Toolkit: Received message', request);    console.log('SOC Toolkit: Received message', request);

        

    if (request.action === 'getSelectedText') {    if (request.action === 'getSelectedText') {

      const selectedText = window.getSelection().toString().trim();      const selectedText = window.getSelection().toString().trim();

      sendResponse({ text: selectedText });      sendResponse({ text: selectedText });

    }    }

        

    if (request.action === 'highlightIOCs') {    if (request.action === 'highlightIOCs') {

      highlightIOCsOnPage(request.iocs);      highlightIOCsOnPage(request.iocs);

      sendResponse({ success: true });      sendResponse({ success: true });

    }    }



    if (request.action === 'triggerSnippetSearch') {    if (request.action === 'triggerSnippetSearch') {

      console.log('SOC Toolkit: Triggering snippet search');      console.log('SOC Toolkit: Triggering snippet search');

      triggerSnippetSearchAtCursor();      triggerSnippetSearchAtCursor();

      sendResponse({ success: true });      sendResponse({ success: true });

    }    }



    if (request.action === 'toggleSnippets') {    if (request.action === 'toggleSnippets') {

      console.log('SOC Toolkit: Toggling snippets');      console.log('SOC Toolkit: Toggling snippets');

      toggleSnippetExpansion();      toggleSnippetExpansion();

      sendResponse({ success: true });      sendResponse({ success: true });

    }    }

  });  });



  // Function to trigger snippet search at cursor position  // Function to trigger snippet search at cursor position

  function triggerSnippetSearchAtCursor() {  function triggerSnippetSearchAtCursor() {

    const activeElement = document.activeElement;    const activeElement = document.activeElement;

        

    if (isEditableElement(activeElement)) {    if (isEditableElement(activeElement)) {

      console.log('SOC Toolkit: Triggering snippet search in input field');      console.log('SOC Toolkit: Triggering snippet search in input field');

      // If we're in an input field, show suggestions based on current content      // If we're in an input field, show suggestions based on current content

      activeInput = activeElement;      activeInput = activeElement;

      checkForSnippetTrigger(activeElement);      checkForSnippetTrigger(activeElement);

    } else {    } else {

      console.log('SOC Toolkit: Showing global snippet overlay');      console.log('SOC Toolkit: Showing global snippet overlay');

      // If not in an input field, show the global overlay      // If not in an input field, show the global overlay

      showGlobalSnippetOverlay();      showGlobalSnippetOverlay();

    }    }

  }  }

  });

  // Function to highlight IOCs on the current page

  function highlightIOCsOnPage(iocs) {  // Function to highlight IOCs on the current page

    if (!iocs || iocs.length === 0) return;  function highlightIOCsOnPage(iocs) {

    if (!iocs || iocs.length === 0) return;

    // Add styles for highlighting

    let style = document.getElementById('soc-highlight-styles');    // Create a style element for highlighting

    if (!style) {    const style = document.createElement('style');

      style = document.createElement('style');    style.id = 'soc-toolkit-highlights';

      style.id = 'soc-highlight-styles';    style.textContent = `

      style.textContent = `      .soc-highlight {

        .soc-highlight {        background-color: #fef3c7 !important;

          background-color: #fef3c7 !important;        border: 1px solid #f59e0b !important;

          border: 1px solid #f59e0b !important;        border-radius: 2px !important;

          border-radius: 2px !important;        padding: 1px 2px !important;

          padding: 0 2px !important;        font-weight: bold !important;

        }      }

        .soc-highlight-ip { background-color: #ddd6fe !important; border-color: #8b5cf6 !important; }      .soc-highlight-ip { border-color: #3b82f6 !important; background-color: #dbeafe !important; }

        .soc-highlight-domain { background-color: #bfdbfe !important; border-color: #3b82f6 !important; }      .soc-highlight-domain { border-color: #10b981 !important; background-color: #d1fae5 !important; }

        .soc-highlight-hash { background-color: #f3e8ff !important; border-color: #a855f7 !important; }      .soc-highlight-url { border-color: #8b5cf6 !important; background-color: #ede9fe !important; }

        .soc-highlight-email { background-color: #d1fae5 !important; border-color: #10b981 !important; }      .soc-highlight-email { border-color: #f59e0b !important; background-color: #fef3c7 !important; }

        .soc-highlight-url { background-color: #fed7d7 !important; border-color: #f56565 !important; }      .soc-highlight-hash { border-color: #ef4444 !important; background-color: #fee2e2 !important; }

        @keyframes slideInRight {    `;

          from { transform: translateX(100%); opacity: 0; }    

          to { transform: translateX(0); opacity: 1; }    // Remove existing highlights

        }    const existingStyle = document.getElementById('soc-toolkit-highlights');

      `;    if (existingStyle) existingStyle.remove();

      document.head.appendChild(style);    

    }    document.head.appendChild(style);



    // Find all text nodes and highlight IOCs    // Get all text nodes

    const walker = document.createTreeWalker(    const walker = document.createTreeWalker(

      document.body,      document.body,

      NodeFilter.SHOW_TEXT,      NodeFilter.SHOW_TEXT,

      null,      {

      false        acceptNode: function(node) {

    );          // Skip script and style elements

          const parent = node.parentElement;

    const textNodes = [];          if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {

    let node;            return NodeFilter.FILTER_REJECT;

    while (node = walker.nextNode()) {          }

      if (node.parentNode.tagName !== 'SCRIPT' && node.parentNode.tagName !== 'STYLE') {          return NodeFilter.FILTER_ACCEPT;

        textNodes.push(node);        }

      }      }

    }    );



    textNodes.forEach(textNode => {    const textNodes = [];

      let text = textNode.textContent;    let node;

      let hasMatches = false;    while (node = walker.nextNode()) {

            textNodes.push(node);

      iocs.forEach(ioc => {    }

        const regex = new RegExp(escapeRegExp(ioc.value), 'gi');

        if (regex.test(text)) {    // Highlight IOCs in text nodes

          hasMatches = true;    textNodes.forEach(textNode => {

          text = text.replace(regex, `<span class="soc-highlight soc-highlight-${ioc.category}" title="IOC: ${ioc.type}">$&</span>`);      let text = textNode.textContent;

        }      let hasMatches = false;

      });      

      iocs.forEach(ioc => {

      if (hasMatches) {        const regex = new RegExp(escapeRegExp(ioc.value), 'gi');

        const wrapper = document.createElement('span');        if (regex.test(text)) {

        wrapper.innerHTML = text;          hasMatches = true;

        textNode.parentNode.replaceChild(wrapper, textNode);          text = text.replace(regex, `<span class="soc-highlight soc-highlight-${ioc.category}" title="IOC: ${ioc.type}">$&</span>`);

      }        }

    });      });



    // Show notification      if (hasMatches) {

    showPageNotification(`Highlighted ${iocs.length} IOCs on this page`);        const wrapper = document.createElement('span');

  }        wrapper.innerHTML = text;

        textNode.parentNode.replaceChild(wrapper, textNode);

  // Utility function to escape regex special characters      }

  function escapeRegExp(string) {    });

    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  }    // Show notification

    showPageNotification(`Highlighted ${iocs.length} IOCs on this page`);

  // Show a temporary notification on the page  }

  function showPageNotification(message) {

    const notification = document.createElement('div');  // Utility function to escape regex special characters

    notification.style.cssText = `  function escapeRegExp(string) {

      position: fixed;    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      top: 20px;  }

      right: 20px;

      background: #1f2937;  // Show a temporary notification on the page

      color: #f9fafb;  function showPageNotification(message) {

      padding: 12px 16px;    const notification = document.createElement('div');

      border-radius: 6px;    notification.style.cssText = `

      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;      position: fixed;

      font-size: 14px;      top: 20px;

      z-index: 10000;      right: 20px;

      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);      background: #1f2937;

      border-left: 4px solid #3b82f6;      color: #f9fafb;

      animation: slideInRight 0.3s ease;      padding: 12px 16px;

    `;      border-radius: 6px;

          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

    notification.innerHTML = `      font-size: 14px;

      <div style="display: flex; align-items: center; gap: 8px;">      z-index: 10000;

        <span style="color: #3b82f6;">🛡️</span>      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

        <span>${message}</span>      border-left: 4px solid #3b82f6;

      </div>      animation: slideInRight 0.3s ease;

    `;    `;

        

    document.body.appendChild(notification);    notification.innerHTML = `

          <div style="display: flex; align-items: center; gap: 8px;">

    setTimeout(() => {        <span style="color: #3b82f6;">🛡️</span>

      notification.style.animation = 'slideInRight 0.3s ease reverse';        <span>${message}</span>

      setTimeout(() => {      </div>

        if (notification.parentNode) {    `;

          notification.parentNode.removeChild(notification);

        }    // Add animation

      }, 300);    const style = document.createElement('style');

    }, 3000);    style.textContent = `

  }      @keyframes slideInRight {

        from { transform: translateX(100%); opacity: 0; }

  // Add CSS animation for notification        to { transform: translateX(0); opacity: 1; }

  if (!document.getElementById('soc-notification-styles')) {      }

    const style = document.createElement('style');    `;

    style.id = 'soc-notification-styles';    document.head.appendChild(style);

    style.textContent = `

      @keyframes slideInRight {    document.body.appendChild(notification);

        from { transform: translateX(100%); opacity: 0; }

        to { transform: translateX(0); opacity: 1; }    // Remove after 3 seconds

      }    setTimeout(() => {

    `;      notification.style.animation = 'slideInRight 0.3s ease reverse';

    document.head.appendChild(style);      setTimeout(() => {

  }        if (notification.parentNode) {

          notification.parentNode.removeChild(notification);

  // Toggle snippet expansion        }

  function toggleSnippetExpansion() {        if (style.parentNode) {

    snippetExpansionEnabled = !snippetExpansionEnabled;          style.parentNode.removeChild(style);

    showPageNotification(        }

      snippetExpansionEnabled       }, 300);

        ? '🛡️ Snippet expansion enabled'     }, 3000);

        : '🛡️ Snippet expansion disabled'  }

    );

      // ------------------ Global snippet controls ------------------

    if (!snippetExpansionEnabled) {

      hideSuggestions();  function triggerSnippetSearchAtCursor() {

    }    const activeEl = document.activeElement;

  }    if (!activeEl || (!isEditableElement(activeEl))) {

      // Show global snippet overlay if no active editable element

  function isEditableElement(el) {      showGlobalSnippetOverlay();

    return el && (      return;

      el.tagName === 'TEXTAREA' ||    }

      el.tagName === 'INPUT' ||

      el.isContentEditable ||    // Force show suggestions for current input

      el.getAttribute('contenteditable') === 'true'    const { token, tokenStart } = getTokenLeft(activeEl);

    );    const matches = filterMatches(token || '');

  }    if (matches.length > 0) {

      renderMatches(matches, activeEl, tokenStart);

  function showGlobalSnippetOverlay() {    } else {

    if (!snippets.length) {      // Show all snippets if no token match

      showPageNotification('No snippets available');      renderMatches(snippets.slice(0, 10), activeEl, tokenStart);

      return;    }

    }  }



    const overlay = createGlobalOverlay();  function toggleSnippetExpansion() {

    const list = overlay.querySelector('.snippet-list');    snippetExpansionEnabled = !snippetExpansionEnabled;

        showPageNotification(

    snippets.slice(0, 20).forEach((snippet, index) => {      snippetExpansionEnabled 

      const item = document.createElement('div');        ? '🛡️ Snippet expansion enabled' 

      item.className = 'snippet-item';        : '🛡️ Snippet expansion disabled'

      item.style.cssText = `    );

        padding: 8px 12px;    

        cursor: pointer;    if (!snippetExpansionEnabled) {

        border-bottom: 1px solid rgba(55,65,81,0.3);      hideSuggestions();

        display: flex;    }

        justify-content: space-between;  }

        align-items: center;

      `;  function isEditableElement(el) {

          return el && (

      if (index === 0) item.classList.add('selected');      el.tagName === 'TEXTAREA' ||

            el.tagName === 'INPUT' ||

      item.innerHTML = `      el.isContentEditable ||

        <div>      el.getAttribute('contenteditable') === 'true'

          <div style="font-weight: bold; color: #3b82f6;">${snippet.trigger || ''}</div>    );

          <div style="font-size: 12px; color: #9ca3af;">${snippet.name || ''}</div>  }

        </div>

        <div style="font-size: 11px; color: #6b7280; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">  function showGlobalSnippetOverlay() {

          ${(snippet.content || '').substring(0, 50)}${snippet.content && snippet.content.length > 50 ? '...' : ''}    if (!snippets.length) {

        </div>      showPageNotification('No snippets available');

      `;      return;

          }

      item.addEventListener('click', () => {

        copyToClipboard(snippet.content || '');    const overlay = createGlobalOverlay();

        showPageNotification(`Copied "${snippet.name}" to clipboard`);    const list = overlay.querySelector('.snippet-list');

        overlay.remove();    

      });    snippets.slice(0, 20).forEach((snippet, index) => {

            const item = document.createElement('div');

      list.appendChild(item);      item.className = 'snippet-item';

    });      item.style.cssText = `

        padding: 8px 12px;

    // Handle keyboard navigation        cursor: pointer;

    let selectedIndex = 0;        border-bottom: 1px solid rgba(55,65,81,0.3);

    const handleKeydown = (e) => {        display: flex;

      const items = list.querySelectorAll('.snippet-item');        justify-content: space-between;

              align-items: center;

      if (e.key === 'ArrowDown') {      `;

        e.preventDefault();      

        items[selectedIndex].classList.remove('selected');      if (index === 0) item.classList.add('selected');

        selectedIndex = Math.min(items.length - 1, selectedIndex + 1);      

        items[selectedIndex].classList.add('selected');      item.innerHTML = `

        items[selectedIndex].scrollIntoView({ block: 'nearest' });        <div>

      } else if (e.key === 'ArrowUp') {          <div style="font-weight: bold; color: #3b82f6;">${snippet.trigger || ''}</div>

        e.preventDefault();          <div style="font-size: 12px; color: #9ca3af;">${snippet.name || ''}</div>

        items[selectedIndex].classList.remove('selected');        </div>

        selectedIndex = Math.max(0, selectedIndex - 1);        <div style="font-size: 11px; color: #6b7280; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">

        items[selectedIndex].classList.add('selected');          ${(snippet.content || '').substring(0, 50)}${snippet.content && snippet.content.length > 50 ? '...' : ''}

        items[selectedIndex].scrollIntoView({ block: 'nearest' });        </div>

      } else if (e.key === 'Enter') {      `;

        e.preventDefault();      

        items[selectedIndex].click();      item.addEventListener('click', () => {

      } else if (e.key === 'Escape') {        copyToClipboard(snippet.content || '');

        e.preventDefault();        showPageNotification(`Copied "${snippet.name}" to clipboard`);

        overlay.remove();        overlay.remove();

      }      });

    };      

      list.appendChild(item);

    document.addEventListener('keydown', handleKeydown);    });

    overlay.addEventListener('click', (e) => {

      if (e.target === overlay) overlay.remove();    // Handle keyboard navigation

    });    let selectedIndex = 0;

    const handleKeydown = (e) => {

    // Cleanup when overlay is removed      const items = list.querySelectorAll('.snippet-item');

    const observer = new MutationObserver((mutations) => {      

      mutations.forEach((mutation) => {      if (e.key === 'ArrowDown') {

        mutation.removedNodes.forEach((node) => {        e.preventDefault();

          if (node === overlay) {        items[selectedIndex].classList.remove('selected');

            document.removeEventListener('keydown', handleKeydown);        selectedIndex = Math.min(items.length - 1, selectedIndex + 1);

            observer.disconnect();        items[selectedIndex].classList.add('selected');

          }        items[selectedIndex].scrollIntoView({ block: 'nearest' });

        });      } else if (e.key === 'ArrowUp') {

      });        e.preventDefault();

    });        items[selectedIndex].classList.remove('selected');

    observer.observe(document.body, { childList: true });        selectedIndex = Math.max(0, selectedIndex - 1);

  }        items[selectedIndex].classList.add('selected');

        items[selectedIndex].scrollIntoView({ block: 'nearest' });

  function createGlobalOverlay() {      } else if (e.key === 'Enter') {

    // Remove existing overlay        e.preventDefault();

    const existing = document.getElementById('soc-global-snippet-overlay');        items[selectedIndex].click();

    if (existing) existing.remove();      } else if (e.key === 'Escape') {

        e.preventDefault();

    const overlay = document.createElement('div');        overlay.remove();

    overlay.id = 'soc-global-snippet-overlay';      }

    overlay.style.cssText = `    };

      position: fixed;

      top: 0;    document.addEventListener('keydown', handleKeydown);

      left: 0;    overlay.addEventListener('click', (e) => {

      width: 100%;      if (e.target === overlay) overlay.remove();

      height: 100%;    });

      background: rgba(0, 0, 0, 0.7);

      z-index: 2147483647;    // Cleanup when overlay is removed

      display: flex;    const observer = new MutationObserver((mutations) => {

      justify-content: center;      mutations.forEach((mutation) => {

      align-items: center;        mutation.removedNodes.forEach((node) => {

    `;          if (node === overlay) {

            document.removeEventListener('keydown', handleKeydown);

    const container = document.createElement('div');            observer.disconnect();

    container.style.cssText = `          }

      background: #0b1220;        });

      color: #e5e7eb;      });

      border: 1px solid rgba(55,65,81,0.9);    });

      border-radius: 8px;    observer.observe(document.body, { childList: true });

      width: 600px;  }

      max-width: 90vw;

      max-height: 80vh;  function createGlobalOverlay() {

      overflow: hidden;    // Remove existing overlay

      box-shadow: 0 20px 40px rgba(0,0,0,0.5);    const existing = document.getElementById('soc-global-snippet-overlay');

    `;    if (existing) existing.remove();



    const header = document.createElement('div');    const overlay = document.createElement('div');

    header.style.cssText = `    overlay.id = 'soc-global-snippet-overlay';

      padding: 16px;    overlay.style.cssText = `

      border-bottom: 1px solid rgba(55,65,81,0.3);      position: fixed;

      font-weight: bold;      top: 0;

      display: flex;      left: 0;

      justify-content: space-between;      width: 100%;

      align-items: center;      height: 100%;

    `;      background: rgba(0, 0, 0, 0.7);

    header.innerHTML = `      z-index: 2147483647;

      <span>🛡️ SOC Toolkit Snippets</span>      display: flex;

      <span style="font-size: 12px; color: #9ca3af;">Press Enter to copy, Esc to close</span>      justify-content: center;

    `;      align-items: center;

    `;

    const list = document.createElement('div');

    list.className = 'snippet-list';    const container = document.createElement('div');

    list.style.cssText = `    container.style.cssText = `

      max-height: 400px;      background: #0b1220;

      overflow-y: auto;      color: #e5e7eb;

    `;      border: 1px solid rgba(55,65,81,0.9);

      border-radius: 8px;

    container.appendChild(header);      width: 600px;

    container.appendChild(list);      max-width: 90vw;

    overlay.appendChild(container);      max-height: 80vh;

    document.body.appendChild(overlay);      overflow: hidden;

      box-shadow: 0 20px 40px rgba(0,0,0,0.5);

    return overlay;    `;

  }

    const header = document.createElement('div');

  function copyToClipboard(text) {    header.style.cssText = `

    if (navigator.clipboard && navigator.clipboard.writeText) {      padding: 16px;

      navigator.clipboard.writeText(text);      border-bottom: 1px solid rgba(55,65,81,0.3);

    } else {      font-weight: bold;

      // Fallback method      display: flex;

      const textarea = document.createElement('textarea');      justify-content: space-between;

      textarea.value = text;      align-items: center;

      document.body.appendChild(textarea);    `;

      textarea.select();    header.innerHTML = `

      document.execCommand('copy');      <span>🛡️ SOC Toolkit Snippets</span>

      document.body.removeChild(textarea);      <span style="font-size: 12px; color: #9ca3af;">Press Enter to copy, Esc to close</span>

    }    `;

  }

    const list = document.createElement('div');

  // ------------------ Snippet suggestions & expansion ------------------    list.className = 'snippet-list';

    list.style.cssText = `

  function createSuggestionBox() {      max-height: 400px;

    const existing = document.getElementById(SUGGESTION_ID);      overflow-y: auto;

    if (existing) return existing;    `;

    

    const box = document.createElement('div');    container.appendChild(header);

    box.id = SUGGESTION_ID;    container.appendChild(list);

    box.style.cssText = `    overlay.appendChild(container);

      position: absolute;    document.body.appendChild(overlay);

      background: #0b1220;

      color: #e5e7eb;    return overlay;

      border: 1px solid rgba(55,65,81,0.9);  }

      border-radius: 6px;

      z-index: 2147483647;  function copyToClipboard(text) {

      max-height: 220px;    if (navigator.clipboard && navigator.clipboard.writeText) {

      overflow: auto;      navigator.clipboard.writeText(text);

      display: none;    } else {

      font-size: 13px;      // Fallback method

      box-shadow: 0 4px 12px rgba(0,0,0,0.3);      const textarea = document.createElement('textarea');

    `;      textarea.value = text;

    document.body.appendChild(box);      document.body.appendChild(textarea);

    return box;      textarea.select();

  }      document.execCommand('copy');

      document.body.removeChild(textarea);

  function hideSuggestions() {    }

    if (suggestionBox) {  }

      suggestionBox.style.display = 'none';

      suggestionBox.innerHTML = '';  // ------------------ Snippet suggestions & expansion ------------------

    }

    selectedIndex = -1;  function createSuggestionBox() {

  }    const existing = document.getElementById(SUGGESTION_ID);

    if (existing) return existing;

  function getTokenLeft(el) {    const box = document.createElement('div');

    if (!el) return { token: '', tokenStart: 0 };    box.id = SUGGESTION_ID;

        box.style.position = 'absolute';

    let text = '';    box.style.background = '#0b1220';

    let cursorPos = 0;    box.style.color = '#e5e7eb';

        box.style.border = '1px solid rgba(55,65,81,0.9)';

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {    box.style.borderRadius = '6px';

      text = el.value;    box.style.zIndex = 2147483647;

      cursorPos = el.selectionStart;    box.style.maxHeight = '220px';

    } else if (el.isContentEditable) {    box.style.overflow = 'auto';

      text = el.textContent || '';    box.style.display = 'none';

      const selection = window.getSelection();    box.style.fontSize = '13px';

      if (selection.rangeCount > 0) {    box.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';

        const range = selection.getRangeAt(0);    document.body.appendChild(box);

        cursorPos = range.startOffset;    return box;

      }  }

    }

      function hideSuggestions() {

    // Find the start of the current word    if (suggestionBox) {

    let tokenStart = cursorPos;      suggestionBox.style.display = 'none';

    while (tokenStart > 0 && /\S/.test(text[tokenStart - 1])) {      suggestionBox.innerHTML = '';

      tokenStart--;    }

    }    selectedIndex = -1;

      }

    const token = text.substring(tokenStart, cursorPos);

    return { token: token.trim(), tokenStart };  function getTokenLeft(el) {

  }    if (!el) return { token: '', tokenStart: 0 };

    

  function checkForSnippetTrigger(el) {    let text = '';

    if (!snippetExpansionEnabled || !el) return;    let cursorPos = 0;

        

    const { token, tokenStart } = getTokenLeft(el);    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {

    console.log('SOC Toolkit: Checking token:', token);      text = el.value;

          cursorPos = el.selectionStart;

    // Check if token starts with any prefix    } else if (el.isContentEditable) {

    const hasPrefix = prefixes.some(prefix => token.startsWith(prefix));      text = el.textContent || '';

    if (!hasPrefix) return hideSuggestions();      const selection = window.getSelection();

          if (selection.rangeCount > 0) {

    // Find matches        const range = selection.getRangeAt(0);

    const query = token.substring(1).toLowerCase(); // Remove prefix        cursorPos = range.startOffset;

    const matches = snippets.filter(snippet => {      }

      const trigger = (snippet.trigger || '').toLowerCase();    }

      const name = (snippet.name || '').toLowerCase();    

      return trigger.includes(query) || name.includes(query);    // Find the start of the current word

    });    let tokenStart = cursorPos;

        while (tokenStart > 0 && /\S/.test(text[tokenStart - 1])) {

    console.log('SOC Toolkit: Found matches:', matches.length);      tokenStart--;

    if (!matches.length) return hideSuggestions();    }

    renderMatches(matches, el, tokenStart);    

  }    const token = text.substring(tokenStart, cursorPos);

    return { token: token.trim(), tokenStart };

  function renderMatches(matches, el, tokenStart) {  }

    if (!suggestionBox) return;

      function checkForSnippetTrigger(el) {

    suggestionBox.innerHTML = '';    if (!snippetExpansionEnabled || !el) return;

    selectedIndex = 0;    

        const { token, tokenStart } = getTokenLeft(el);

    matches.slice(0, 10).forEach((snippet, index) => {    

      const item = document.createElement('div');    // Check if token starts with any prefix

      item.className = 'soct-sugg';    const hasPrefix = prefixes.some(prefix => token.startsWith(prefix));

      item.style.cssText = `    if (!hasPrefix) return hideSuggestions();

        padding: 8px 12px;    

        cursor: pointer;    // Find matches

        border-bottom: 1px solid rgba(55,65,81,0.3);    const query = token.substring(1).toLowerCase(); // Remove prefix

        ${index === 0 ? 'background: #1e40af;' : ''}    const matches = snippets.filter(snippet => {

      `;      const trigger = (snippet.trigger || '').toLowerCase();

            const name = (snippet.name || '').toLowerCase();

      item.innerHTML = `      return trigger.includes(query) || name.includes(query);

        <div style="font-weight: bold;">${snippet.trigger || snippet.name}</div>    });

        <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">    

          ${(snippet.content || '').substring(0, 80)}${snippet.content && snippet.content.length > 80 ? '...' : ''}    if (!matches.length) return hideSuggestions();

        </div>    renderMatches(matches, el, tokenStart);

      `;  }

      

      item.addEventListener('click', () => {  function renderMatches(matches, el, tokenStart) {

        applySnippet(snippet, el, tokenStart);    if (!suggestionBox) return;

      });    

          suggestionBox.innerHTML = '';

      suggestionBox.appendChild(item);    selectedIndex = 0;

    });    

        matches.slice(0, 10).forEach((snippet, index) => {

    // Position the suggestion box      const item = document.createElement('div');

    positionSuggestionBox(el);      item.className = 'soct-sugg';

    suggestionBox.style.display = 'block';      item.style.cssText = `

    activeInput = el;        padding: 8px 12px;

  }        cursor: pointer;

        border-bottom: 1px solid rgba(55,65,81,0.3);

  function positionSuggestionBox(el) {        ${index === 0 ? 'background: #1e40af;' : ''}

    if (!suggestionBox || !el) return;      `;

          

    const rect = el.getBoundingClientRect();      item.innerHTML = `

    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;        <div style="font-weight: bold;">${snippet.trigger || snippet.name}</div>

    const scrollY = window.pageYOffset || document.documentElement.scrollTop;        <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">

              ${(snippet.content || '').substring(0, 80)}${snippet.content && snippet.content.length > 80 ? '...' : ''}

    suggestionBox.style.left = (rect.left + scrollX) + 'px';        </div>

    suggestionBox.style.top = (rect.bottom + scrollY + 5) + 'px';      `;

    suggestionBox.style.minWidth = Math.max(200, rect.width) + 'px';      

  }      item.addEventListener('click', () => {

        applySnippet(snippet, el, tokenStart);

  function applySnippet(snippet, el, tokenStart) {      });

    if (!snippet || !el) return;      

          suggestionBox.appendChild(item);

    console.log('SOC Toolkit: Applying snippet', snippet.name);    });

        

    const content = snippet.content || '';    // Position the suggestion box

        positionSuggestionBox(el);

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {    suggestionBox.style.display = 'block';

      const currentValue = el.value;    activeInput = el;

      const { token } = getTokenLeft(el);  }

      const beforeCursor = currentValue.substring(0, tokenStart);

      const afterCursor = currentValue.substring(el.selectionStart);  function positionSuggestionBox(el) {

          if (!suggestionBox || !el) return;

      el.value = beforeCursor + content + afterCursor;    

      el.selectionStart = el.selectionEnd = tokenStart + content.length;    const rect = el.getBoundingClientRect();

      el.focus();    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

    } else if (el.isContentEditable) {    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

      const selection = window.getSelection();    

      if (selection.rangeCount > 0) {    suggestionBox.style.left = (rect.left + scrollX) + 'px';

        const range = selection.getRangeAt(0);    suggestionBox.style.top = (rect.bottom + scrollY + 5) + 'px';

        range.deleteContents();    suggestionBox.style.minWidth = Math.max(200, rect.width) + 'px';

        const textNode = document.createTextNode(content);  }

        range.insertNode(textNode);

        range.setStartAfter(textNode);  function applySnippet(snippet, el, tokenStart) {

        range.setEndAfter(textNode);    if (!snippet || !el) return;

        selection.removeAllRanges();    

        selection.addRange(range);    console.log('SOC Toolkit: Applying snippet', snippet.name);

      }    

    }    const content = snippet.content || '';

        

    hideSuggestions();    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {

          const currentValue = el.value;

    // Trigger input event for frameworks that listen to it      const { token } = getTokenLeft(el);

    el.dispatchEvent(new Event('input', { bubbles: true }));      const beforeCursor = currentValue.substring(0, tokenStart);

  }      const afterCursor = currentValue.substring(el.selectionStart);

      

  function onInputEvent(e) {      el.value = beforeCursor + content + afterCursor;

    if (!snippetExpansionEnabled) return;      el.selectionStart = el.selectionEnd = tokenStart + content.length;

    const el = e.target;      el.focus();

    if (!isEditableElement(el)) return;    } else if (el.isContentEditable) {

    checkForSnippetTrigger(el);      const selection = window.getSelection();

  }      if (selection.rangeCount > 0) {

        const range = selection.getRangeAt(0);

  function onKeydown(e) {        range.deleteContents();

    if (!snippetExpansionEnabled) return;        const textNode = document.createTextNode(content);

            range.insertNode(textNode);

    if (!suggestionBox || suggestionBox.style.display === 'none') return;        range.setStartAfter(textNode);

    const items = Array.from(suggestionBox.querySelectorAll('.soct-sugg'));        range.setEndAfter(textNode);

    if (!items.length) return;        selection.removeAllRanges();

            selection.addRange(range);

    if (e.key === 'ArrowDown') {      }

      e.preventDefault();    }

      selectedIndex = Math.min(items.length - 1, selectedIndex + 1);    

      items.forEach((it, idx) => it.style.background = idx === selectedIndex ? '#1e40af' : '');    hideSuggestions();

      items[selectedIndex].scrollIntoView({ block: 'nearest' });    

    } else if (e.key === 'ArrowUp') {    // Trigger input event for frameworks that listen to it

      e.preventDefault();    el.dispatchEvent(new Event('input', { bubbles: true }));

      selectedIndex = Math.max(0, selectedIndex - 1);  }

      items.forEach((it, idx) => it.style.background = idx === selectedIndex ? '#1e40af' : '');

      items[selectedIndex].scrollIntoView({ block: 'nearest' });  function onInputEvent(e) {

    } else if (e.key === 'Enter' || e.key === 'Tab') {    if (!snippetExpansionEnabled) return;

      e.preventDefault();    const el = e.target;

      const sel = selectedIndex >= 0 ? selectedIndex : 0;    if (!isEditableElement(el)) return;

      const item = items[sel];    checkForSnippetTrigger(el);

      if (item) {  }

        item.click();    box.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';

      }    document.documentElement.appendChild(box);

    } else if (e.key === 'Escape') {    return box;

      hideSuggestions();  }

    }

  }  function hideSuggestions() {

    if (!suggestionBox) return;

  function attachTo(el) {    suggestionBox.style.display = 'none';

    if (!el || el._soct_attached) return;    suggestionBox.innerHTML = '';

    el._soct_attached = true;    selectedIndex = -1;

    el.addEventListener('input', onInputEvent);  }

    el.addEventListener('keydown', onKeydown);

    el.addEventListener('blur', () => {  function positionBoxFor(el) {

      setTimeout(() => {     if (!suggestionBox) return;

        if (document.activeElement !== el) hideSuggestions();     const r = el.getBoundingClientRect();

      }, 150);    suggestionBox.style.left = (window.scrollX + r.left) + 'px';

    });    suggestionBox.style.top = (window.scrollY + r.bottom + 6) + 'px';

  }    suggestionBox.style.width = Math.max(200, r.width) + 'px';

  }

  function scanAndAttach(root = document) {

    const inputs = Array.from(root.querySelectorAll('input[type=text], input:not([type]), input[type=search], input[type=url], input[type=email], textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]'));  function getTokenLeft(el) {

    inputs.forEach(attachTo);    try {

          if (el.isContentEditable) {

    // Also try to attach to any element that might be editable        const sel = window.getSelection();

    const potentialInputs = Array.from(root.querySelectorAll('div, span, p')).filter(el => {        if (!sel || !sel.rangeCount) return { token: '', tokenStartOffset: 0 };

      return el.isContentEditable ||         const range = sel.getRangeAt(0).cloneRange();

             el.getAttribute('contenteditable') === 'true' ||        const preRange = range.cloneRange();

             el.getAttribute('role') === 'textbox' ||        preRange.selectNodeContents(el);

             el.classList.contains('ace_text-input') || // Code editors        preRange.setEnd(range.endContainer, range.endOffset);

             el.classList.contains('monaco-editor') ||        const leftText = preRange.toString();

             el.classList.contains('CodeMirror-code');        const m = leftText.match(/(\S+)$/);

    });        return { token: m ? m[1] : '', tokenStartOffset: m ? leftText.lastIndexOf(m[1]) : 0 };

    potentialInputs.forEach(attachTo);      } else {

  }        const pos = el.selectionStart ?? 0;

        const start = Math.max(0, pos - 100);

  function loadSnippetsAndPrefixes(cb) {        const left = el.value.slice(start, pos);

    try {        const m = left.match(/(\S+)$/);

      chrome.storage.local.get(['snippets','socSettings'], (res) => {        const token = m ? m[1] : '';

        snippets = Array.isArray(res.snippets) ? res.snippets : [];        const tokenStart = start + (m ? left.lastIndexOf(m[1]) : 0);

        const s = res.socSettings || {};        return { token, tokenStart, pos };

        prefixes = Array.isArray(s.snippetPrefixes) ? s.snippetPrefixes : (s.snippetPrefixes ? s.snippetPrefixes : ['$']);      }

        if (typeof prefixes === 'string') prefixes = prefixes.split(',').map(p => p.trim()).filter(Boolean);    } catch (e) {

        if (cb) cb();      return { token: '', tokenStart: 0 };

      });    }

    } catch (e) {  }

      console.error('SOC Toolkit: Error loading snippets:', e);

      snippets = [];  function filterMatches(token) {

      prefixes = ['$'];    if (!token) return [];

      if (cb) cb();    const q = token.toLowerCase();

    }    return snippets.filter(s => (s.trigger || '').toLowerCase().startsWith(q));

  }  }



  // Initialize snippet system  function applySnippet(s, el, tokenStart) {

  console.log('SOC Toolkit: Initializing snippet system');    if (!el) return;

  suggestionBox = createSuggestionBox();    if (el.isContentEditable) {

  loadSnippetsAndPrefixes(() => {      // Best-effort: insert text at caret

    console.log('SOC Toolkit: Loaded', snippets.length, 'snippets with prefixes:', prefixes);      document.execCommand('insertText', false, s.content || '');

    scanAndAttach();    } else {

          const value = el.value;

    // Watch for dynamic content changes      const before = value.slice(0, tokenStart);

    const obs = new MutationObserver(() => {       const after = value.slice(el.selectionStart ?? 0);

      scanAndAttach(document);       el.value = before + (s.content || '') + after;

    });      const newPos = (before + (s.content || '')).length;

    obs.observe(document.documentElement, { childList: true, subtree: true });      el.selectionStart = el.selectionEnd = newPos;

          el.dispatchEvent(new Event('input', { bubbles: true }));

    // Update snippets when storage changes    }

    chrome.storage.onChanged.addListener((changes) => {    hideSuggestions();

      if (changes.snippets || changes.socSettings) {  }

        console.log('SOC Toolkit: Storage changed, reloading snippets');

        loadSnippetsAndPrefixes(() => {});  function renderMatches(matches, el, tokenStart) {

      }    if (!suggestionBox) suggestionBox = createSuggestionBox();

    });    suggestionBox.innerHTML = '';

  });    matches.forEach((s, i) => {

      const div = document.createElement('div');

  // Initialize      div.className = 'soct-sugg';

  console.log('SOC Analyst Toolkit content script loaded');      div.style.padding = '8px 10px';

})();      div.style.cursor = 'pointer';
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

  // Initialize snippet system
  console.log('SOC Toolkit: Initializing snippet system');
  suggestionBox = createSuggestionBox();
  loadSnippetsAndPrefixes(() => {
    console.log('SOC Toolkit: Loaded', snippets.length, 'snippets with prefixes:', prefixes);
    scanAndAttach();
    const obs = new MutationObserver(() => { scanAndAttach(document); });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    // Update snippets when storage changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.snippets || changes.socSettings) {
        console.log('SOC Toolkit: Storage changed, reloading snippets');
        loadSnippetsAndPrefixes(() => {});
      }
    });
  });

  // Initialize
  console.log('SOC Analyst Toolkit content script loaded');
})();