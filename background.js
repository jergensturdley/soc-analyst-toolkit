"use strict";

// Global variables
let socSettings = {
  autoAnalyze: true,
  contextMenu: true,
  installedDate: new Date().toISOString()
};
let pendingAnalysis = null;
let floatingWindow = null;
let floatingWindowState = {
  isOpen: false,
  width: 850,
  height: 700,
  left: 100,
  top: 100
};

// Installation and setup handler
chrome.runtime.onInstalled.addListener(async (details) => {
  // On first install, set default settings
  if (details.reason === 'install') {
    chrome.storage.local.set({
      socSettings: {
        autoAnalyze: true,
        contextMenu: true,
        installedDate: new Date().toISOString()
      }
    });
  }

  // Restore floating window if it was open
  await loadFloatingWindowState();
  if (floatingWindowState.isOpen) {
    await restoreFloatingWindow();
  }

  // Always set up context menus on installation or update
  setupContextMenus();
});

// Startup handler - restore floating window if it was open
chrome.runtime.onStartup.addListener(async () => {
  await loadFloatingWindowState();
  if (floatingWindowState.isOpen) {
    await restoreFloatingWindow();
  }
});

// Function to set up all context menus
function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    // Main analyze option
    chrome.contextMenus.create({
      id: 'analyze-selection',
      title: 'Analyze with SOC Toolkit',
      contexts: ['selection']
    });


  // Separator
  chrome.contextMenus.create({
    id: 'separator1',
    type: 'separator',
    contexts: ['selection']
  });

  // OSINT Lookups submenu
  chrome.contextMenus.create({
    id: 'osint-lookups',
    title: 'OSINT Lookups',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'lookup-virustotal',
    parentId: 'osint-lookups',
    title: 'Lookup in VirusTotal',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'lookup-alienvault',
    parentId: 'osint-lookups',
    title: 'Search in AlienVault OTX',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'lookup-abuseipdb',
    parentId: 'osint-lookups',
    title: 'Check in AbuseIPDB',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'lookup-ipinfo',
    parentId: 'osint-lookups',
    title: 'Check in ipinfo.io',
    contexts: ['selection']
  });

  // Text Processing submenu
  chrome.contextMenus.create({
    id: 'text-processing',
    title: 'Text Processing',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'defang-iocs',
    parentId: 'text-processing',
    title: 'Defang IOCs (copy to clipboard)',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'extract-iocs',
    parentId: 'text-processing',
    title: 'Extract IOCs Only',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'url-decode',
    parentId: 'text-processing',
    title: 'URL Decode',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'generate-hash',
    parentId: 'text-processing',
    title: 'Generate Hash (SHA1/SHA256)',
    contexts: ['selection']
  });

  // CyberChef Recipes submenu
  chrome.contextMenus.create({
    id: 'cyberchef-recipes',
    title: 'Security Recipes',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'decode-base64',
    parentId: 'cyberchef-recipes',
    title: 'Decode Base64',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'decode-hex',
    parentId: 'cyberchef-recipes',
    title: 'Decode Hex',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'entropy-analysis',
    parentId: 'cyberchef-recipes',
    title: 'Analyze Entropy',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'extract-strings',
    parentId: 'cyberchef-recipes',
    title: 'Extract Readable Strings',
    contexts: ['selection']
  });

  // Investigation Tools
  chrome.contextMenus.create({
    id: 'separator2',
    type: 'separator',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'add-to-notes',
    title: 'Add to Investigation Notes',
    contexts: ['selection']
  });
  });
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const selectedText = info.selectionText;
  
  switch (info.menuItemId) {
    case 'analyze-selection':
      // Store the selected text for analysis
      pendingAnalysis = selectedText;
      chrome.storage.local.set({ pendingAnalysis });
      chrome.action.openPopup();
      break;
      
    case 'lookup-virustotal':
      openVirusTotalLookup(selectedText);
      break;
      
    case 'lookup-alienvault':
      openAlienVaultLookup(selectedText);
      break;
      
    case 'lookup-abuseipdb':
      openAbuseIPDBLookup(selectedText);
      break;
      
    case 'lookup-ipinfo':
      openIpInfoLookup(selectedText);
      break;
      
    case 'defang-iocs':
      defangAndCopy(selectedText);
      break;
      
    case 'extract-iocs':
      extractIOCsOnly(selectedText);
      break;
      
    case 'url-decode':
      urlDecodeText(selectedText);
      break;
      
    case 'generate-hash':
      generateHashOfText(selectedText);
      break;
      
    case 'decode-base64':
      decodeBase64Text(selectedText);
      break;
      
    case 'decode-hex':
      decodeHexText(selectedText);
      break;
      
    case 'entropy-analysis':
      analyzeEntropy(selectedText);
      break;
      
    case 'extract-strings':
      extractStrings(selectedText);
      break;
      
    case 'add-to-notes':
      addToInvestigationNotes(selectedText);
      break;
  }
});

// Helper functions for context menu actions
function openVirusTotalLookup(text) {
  const cleanText = text.trim();
  const url = `https://www.virustotal.com/gui/search/${encodeURIComponent(cleanText)}`;
  chrome.tabs.create({ url });
}

function openAlienVaultLookup(text) {
  const cleanText = text.trim();
  // Detect IOC type for proper AlienVault endpoint
  let iocType = 'general';
  
  // Check if it's an IP address
  if (/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(cleanText)) {
    iocType = 'ip';
  }
  // Check if it's a hash (MD5, SHA1, SHA256)
  else if (/^[a-f0-9]{32}$/i.test(cleanText)) {
    iocType = 'file'; // MD5
  }
  else if (/^[a-f0-9]{40}$/i.test(cleanText)) {
    iocType = 'file'; // SHA1
  }
  else if (/^[a-f0-9]{64}$/i.test(cleanText)) {
    iocType = 'file'; // SHA256
  }
  // Check if it looks like a domain
  else if (/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(cleanText)) {
    iocType = 'domain';
  }
  // Check if it's a URL
  else if (/^https?:\/\//i.test(cleanText)) {
    iocType = 'url';
  }
  
  let url;
  switch (iocType) {
    case 'ip':
      url = `https://otx.alienvault.com/indicator/ip/${encodeURIComponent(cleanText)}`;
      break;
    case 'domain':
      url = `https://otx.alienvault.com/indicator/domain/${encodeURIComponent(cleanText)}`;
      break;
    case 'file':
      url = `https://otx.alienvault.com/indicator/file/${encodeURIComponent(cleanText)}`;
      break;
    case 'url':
      url = `https://otx.alienvault.com/indicator/url/${encodeURIComponent(cleanText)}`;
      break;
    default:
      // Use general search for unknown types
      url = `https://otx.alienvault.com/browse/global/pulses?q=${encodeURIComponent(cleanText)}`;
  }
  
  chrome.tabs.create({ url });
}

function openAbuseIPDBLookup(text) {
  const cleanText = text.trim();
  const url = `https://www.abuseipdb.com/check/${encodeURIComponent(cleanText)}`;
  chrome.tabs.create({ url });
}

function openIpInfoLookup(text) {
  const cleanText = text.trim();
  const url = `https://ipinfo.io/${encodeURIComponent(cleanText)}`;
  chrome.tabs.create({ url });
}

function defangAndCopy(text) {
  const defanged = text
    .replace(/\./g, '[.]')
    .replace(/http/g, 'hxxp')
    .replace(/https/g, 'hxxps')
    .replace(/ftp/g, 'fxp')
    .replace(/@/g, '[@]');
  
  // Copy to clipboard and show notification
  copyToClipboard(defanged);
  showNotification('IOCs Defanged', `Defanged IOCs copied to clipboard`);
}

function extractIOCsOnly(text) {
  // Use the same IOC extraction logic from popup.js
  chrome.storage.local.set({ 
    pendingAction: 'extract-iocs',
    pendingText: text 
  });
  chrome.action.openPopup();
}

function urlDecodeText(text) {
  try {
    const decoded = decodeURIComponent(text);
    copyToClipboard(decoded);
    showNotification('URL Decoded', 'Decoded text copied to clipboard');
  } catch (e) {
    showNotification('URL Decode Error', 'Invalid URL encoding');
  }
}

async function generateHashOfText(text) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Generate SHA1 and SHA256 in parallel
    const [sha1Buffer, sha256Buffer] = await Promise.all([
      crypto.subtle.digest('SHA-1', data),
      crypto.subtle.digest('SHA-256', data)
    ]);
    
    // Convert buffers to hex strings more efficiently
    const sha1 = bufferToHex(sha1Buffer);
    const sha256 = bufferToHex(sha256Buffer);
    
    const result = `SHA1: ${sha1}\nSHA256: ${sha256}`;
    copyToClipboard(result);
    showNotification('Hashes Generated', 'SHA1 and SHA256 copied to clipboard');
  } catch (e) {
    showNotification('Hash Error', 'Failed to generate hashes');
  }
}

// Helper function to convert buffer to hex string efficiently
function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  const hexParts = [];
  for (let i = 0; i < bytes.length; i++) {
    hexParts.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return hexParts.join('');
}

function decodeBase64Text(text) {
  try {
    const decoded = atob(text.trim());
    copyToClipboard(decoded);
    showNotification('Base64 Decoded', 'Decoded text copied to clipboard');
  } catch (e) {
    showNotification('Base64 Error', 'Invalid Base64 encoding');
  }
}

function decodeHexText(text) {
  try {
    const hex = text.replace(/\s/g, '').replace(/0x/gi, '');
    const decoded = hex.match(/.{1,2}/g)
      .map(byte => String.fromCharCode(parseInt(byte, 16)))
      .join('');
    copyToClipboard(decoded);
    showNotification('Hex Decoded', 'Decoded text copied to clipboard');
  } catch (e) {
    showNotification('Hex Error', 'Invalid hex encoding');
  }
}

function analyzeEntropy(text) {
  const entropy = calculateEntropy(text);
  const result = `Text: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}\nEntropy: ${entropy.toFixed(4)}\nAnalysis: ${entropy > 4.5 ? 'High (possibly encrypted/encoded)' : entropy > 3.5 ? 'Medium' : 'Low (readable text)'}`;
  copyToClipboard(result);
  showNotification('Entropy Analysis', 'Results copied to clipboard');
}

function calculateEntropy(str) {
  const freq = {};
  for (let char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  
  let entropy = 0;
  const len = str.length;
  for (let char in freq) {
    const p = freq[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function extractStrings(text) {
  // Extract readable ASCII strings (4+ characters)
  const strings = text.match(/[ -~]{4,}/g) || [];
  const result = strings.join('\n');
  copyToClipboard(result);
  showNotification('Strings Extracted', `${strings.length} strings copied to clipboard`);
}

function addToInvestigationNotes(text) {
  const timestamp = new Date().toISOString();
  const note = `[${timestamp}] ${text}`;
  
  chrome.storage.local.get(['investigationNotes'], (result) => {
    const notes = result.investigationNotes || [];
    notes.push(note);
    chrome.storage.local.set({ investigationNotes: notes });
    showNotification('Note Added', 'Added to investigation notes');
  });
}

function copyToClipboard(text) {
  // Store in background for content script to copy
  chrome.storage.local.set({ clipboardText: text });
  
  // Try to copy via content script in active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'copyToClipboard', text });
    }
  });
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message
  });
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPendingAnalysis') {
    sendResponse({ text: pendingAnalysis || null });
    pendingAnalysis = null; // Clear after sending
    return true;
  }
  
  if (request.action === 'toggleFloat') {
    handleFloatingWindow(sendResponse);
    return true; // Keep the message channel open for async response
  }
  
  // ... other message handlers
  return true;
});

// Command handler
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

// Floating window state management
async function saveFloatingWindowState() {
  try {
    await chrome.storage.local.set({ floatingWindowState });
  } catch (error) {
    console.error('Error saving floating window state:', error);
  }
}

async function loadFloatingWindowState() {
  try {
    const result = await chrome.storage.local.get(['floatingWindowState']);
    if (result.floatingWindowState) {
      floatingWindowState = { ...floatingWindowState, ...result.floatingWindowState };
    }
  } catch (error) {
    console.error('Error loading floating window state:', error);
  }
}

async function restoreFloatingWindow() {
  try {
    // Check if the window still exists
    if (floatingWindow) {
      try {
        await chrome.windows.get(floatingWindow.id);
        return; // Window still exists, no need to restore
      } catch {
        floatingWindow = null; // Window doesn't exist anymore
      }
    }

    // Create new floating window with saved state
    const window = await chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: floatingWindowState.width,
      height: floatingWindowState.height,
      left: floatingWindowState.left,
      top: floatingWindowState.top,
      focused: false
    });

    floatingWindow = window;
    floatingWindowState.isOpen = true;
    await saveFloatingWindowState();
  } catch (error) {
    console.error('Error restoring floating window:', error);
    floatingWindowState.isOpen = false;
    await saveFloatingWindowState();
  }
}

// Floating window management
async function handleFloatingWindow(sendResponse) {
  try {
    // Close existing floating window if it exists
    if (floatingWindow) {
      await chrome.windows.remove(floatingWindow.id);
      floatingWindow = null;
      floatingWindowState.isOpen = false;
      await saveFloatingWindowState();
      sendResponse({ success: true, action: 'closed' });
      return;
    }

    // Create new floating window
    const window = await chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: floatingWindowState.width,
      height: floatingWindowState.height,
      left: floatingWindowState.left,
      top: floatingWindowState.top,
      focused: true
    });

    floatingWindow = window;
    floatingWindowState.isOpen = true;
    await saveFloatingWindowState();

    // Listen for window close events
    const onRemovedListener = (windowId) => {
      if (windowId === floatingWindow.id) {
        floatingWindow = null;
        floatingWindowState.isOpen = false;
        saveFloatingWindowState();
        chrome.windows.onRemoved.removeListener(onRemovedListener);
      }
    };
    chrome.windows.onRemoved.addListener(onRemovedListener);

    // Listen for window position/size changes
    const onBoundsChangedListener = (window) => {
      if (window.id === floatingWindow.id) {
        floatingWindowState.width = window.width;
        floatingWindowState.height = window.height;
        floatingWindowState.left = window.left;
        floatingWindowState.top = window.top;
        saveFloatingWindowState();
      }
    };
    chrome.windows.onBoundsChanged.addListener(onBoundsChangedListener);

    sendResponse({ success: true, windowId: window.id, action: 'opened' });
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

// Badge setup
chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });