# GitHub Copilot - SOC Analyst Toolkit Instructions

## Project Overview
This is a browser extension (Chrome/Edge) for security operations center (SOC) analysts and cybersecurity professionals. It provides tools to extract and analyze indicators of compromise (IOCs), integrate with OSINT services, and manage snippets. All processing is done locally in the browser for privacy and security.

## Technology Stack
- **Language**: Vanilla JavaScript (ES6+)
- **Build System**: None - this is a pure browser extension with no build step
- **Dependencies**: Minimal external dependencies (vis-network.min.js for graph visualization)
- **Extension Type**: Manifest V3 Chrome extension
- **Storage**: Chrome local storage API

## Project Structure
- `manifest.json` - Extension manifest (Manifest V3)
- `background.js` - Service worker for background tasks and context menus
- `content.js` - Content script that runs on web pages (snippet expansion, text selection)
- `popup.js` - Main popup UI logic (IOC extraction, analysis, snippet management)
- `popup.html` - Popup HTML with inline CSS for theming
- `tlds.js` - List of valid top-level domains for domain validation
- `icons/` - Extension icons
- `css/` - Font Awesome CSS for icons
- `webfonts/` - Font Awesome webfonts

## Coding Standards

### JavaScript Style
- Always use `"use strict";` at the top of function scopes or IIFEs
- Use ES6+ features: `const`, `let`, arrow functions, template literals, async/await, Promises
- Use camelCase for variable and function names
- Use PascalCase for class names
- Prefer `const` over `let` when variables won't be reassigned
- Use descriptive variable names that reflect their purpose
- Add comments for complex logic, especially regex patterns and IOC extraction logic

### Chrome Extension APIs
- Use Chrome Extension API v3 (Manifest V3)
- Primary APIs: `chrome.storage.local`, `chrome.contextMenus`, `chrome.notifications`, `chrome.runtime`
- Always handle async operations with async/await or Promises
- Use message passing between background, content, and popup scripts via `chrome.runtime.sendMessage` and `chrome.runtime.onMessage`

### Code Organization
- Group related functions together
- Keep functions focused and single-purpose
- Use classes for complex state management (e.g., `SOCToolkit` class in popup.js)
- Initialize event listeners in dedicated setup functions

## Security and Privacy

### Critical Requirements
- **Never send data to external servers** - all IOC extraction, parsing, and storage must be local. User-initiated OSINT lookups (e.g., opening VirusTotal links) are allowed as they are explicit user actions.
- **No tracking or analytics** - user privacy is paramount
- **Validate all user inputs** - especially when parsing IOCs or snippets
- **Use CSP-safe code** - no eval(), no inline event handlers in HTML
- **Sanitize HTML** - use `textContent` instead of `innerHTML` when displaying user data, or properly escape if HTML is needed

### IOC Handling
- IOCs (IPs, domains, URLs, hashes, emails) should be validated using robust regex patterns
- Support for defanging IOCs (e.g., `hxxp://` instead of `http://`)
- When opening OSINT links, use proper URL encoding for IOC parameters

## Feature Areas

### IOC Extraction and Analysis
- Extract IPs (IPv4, IPv6), domains, URLs, email addresses, file hashes (MD5, SHA1, SHA256)
- Validate domains against the TLD list in `tlds.js`
- Support defanged IOCs (e.g., `[.]` instead of `.`, `hxxp` instead of `http`)
- Display IOCs grouped by type with color coding

### OSINT Integration
- Provide quick lookup links to VirusTotal, AbuseIPDB, URLScan, etc.
- Support custom OSINT sources configured by users
- Use context menus for quick IOC lookups from selected text

### Snippet Management
- Store snippets locally with titles, content, and tags
- Support snippet expansion using prefix triggers ($ or :)
- Search and filter snippets by title, content, or tags
- Export/import snippets as JSON

### UI/UX
- Three themes available: Matrix (green), Blue, Red
- Tab-based interface: IOC Analysis, Snippets, Settings, OSINT
- Use Font Awesome icons for visual elements
- Responsive design for different popup sizes

## Testing
- **No automated testing framework** - all testing is manual
- When making changes, manually test in Chrome/Edge by loading the unpacked extension
- Test key workflows:
  - IOC extraction from selected text
  - Context menu functionality
  - Snippet creation and expansion
  - Theme switching
  - Settings persistence
- Test edge cases: malformed IOCs, special characters, empty inputs

## Common Tasks

### Adding New IOC Type
1. Add regex pattern to the extraction logic in `popup.js`
2. Add color scheme variables for the new type in `popup.html` CSS
3. Update display logic to show the new IOC type
4. Add OSINT links for the new type if applicable

### Adding New OSINT Source
- Add to the default OSINT sources array in `popup.js`
- Ensure URL template includes `{ioc}` placeholder
- Test that URL encoding works correctly

### Modifying Context Menus
- Update `setupContextMenus()` in `background.js`
- Ensure menu IDs match handler logic in `chrome.contextMenus.onClicked`

### Storage Changes
- Use `chrome.storage.local` for all persistent data
- Always provide default values when reading from storage
- Use async/await for storage operations

## Dependencies
- Do not add new npm packages or build dependencies
- Keep the extension lightweight and dependency-free
- Only add new JavaScript libraries if absolutely necessary (e.g., for visualization)
- If adding libraries, include minified versions directly in the repository

## Documentation
- Update README.md if adding new features
- Add comments for complex algorithms or regex patterns
- Document any new Chrome extension permissions in manifest.json comments

## Known Patterns to Follow

### Event Listener Setup
```javascript
// In a class context
setupEventListeners() {
  document.getElementById('element-id').addEventListener('click', () => {
    this.handleClick();
  });
}
```

### Chrome Storage Pattern
```javascript
async loadSettings() {
  const result = await chrome.storage.local.get(['settingKey']);
  this.setting = result.settingKey || defaultValue;
}
```

### Message Passing Pattern
```javascript
chrome.runtime.sendMessage({ action: 'actionName', data: data }, (response) => {
  // handle response
});
```

## What NOT to Do
- Do not add build tools (webpack, rollup, etc.)
- Do not add package.json or npm dependencies unless absolutely necessary
- Do not break the privacy-first approach by adding external calls
- Do not use jQuery or other heavy frameworks - keep it vanilla JS
- Do not remove existing functionality without explicit requirements
- Do not add automated tests unless explicitly requested (manual testing is the current approach)
