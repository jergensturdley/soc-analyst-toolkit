# SOC Analyst Toolkit - Chrome Extension

A Chrome extension for SOC analysts to quickly analyze IOCs (Indicators of Compromise) and manage code snippets.

## Features

### IOC Analysis
- Extract IOCs from text (IPs, domains, URLs, emails, hashes)
- Generate OSINT links for threat intelligence platforms
- **NEW**: Copy buttons next to each OSINT link for easy URL copying
- Click IOC values to copy them to clipboard

### Enhanced URL Parsing & Decoding
- **Defanged IOC Support**: Automatically converts defanged IOCs back to normal format
  - `hxxps[://]example[.]com` → `https://example.com`
  - `[dot]`, `(dot)`, `DOT` → `.`
  - `[at]`, `(at)`, `AT` → `@`
- **Recursive URL Decoding**: Handles multiple layers of URL encoding
  - `%252F` → `%2F` → `/`
  - Prevents encoding artifacts like trailing `252F`
- **Embedded URL Extraction**: Finds URLs hidden in query parameters
  - Extracts from `TargetUrl`, `redirect`, `link`, `href` parameters
  - Handles complex phishing URLs with multiple redirects
- **Smart URL Cleaning**: Removes encoding artifacts and trailing junk
- **Improved Domain Extraction**: Extracts domains from both direct text and embedded URLs

### Snippet Management
- Create, edit, and delete code snippets
- Variable replacement (${CURRENT_DATE}, ${CURRENT_TIME})
- Import/export snippet collections
- Search functionality

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked" and select the `soc-popup-extension` folder
4. Pin the extension to your toolbar

## Usage

- **Keyboard shortcut**: `Ctrl+Shift+S` (or `Cmd+Shift+S` on Mac)
- **Context menu**: Right-click selected text and choose "Analyze with SOC Toolkit"
- **Extension icon**: Click the SOC Toolkit icon in your toolbar

## Example Use Cases

The enhanced parsing now handles complex scenarios like:

**Defanged URLs:**
```
Input:  hxxps[://]public-usa[.]mkt[.]dynamics[.]com/api/orgs/1877e0f9-c38e-f011-a6fe-000d3a5b9b3d/r/tzTZMJyklEm11k5Nn8QCAAEAAAA?msdynmkt_target=%7B%22TargetUrl%22%3A%22hxxps%253A%252F%252F1wlh8[.]mjt[.]lu%252Flnk%252FAcUAABqoEPAAAAAAAAAAA9_1jiMAAYKIuGIAAAAAADGEKQBowmAFZJy84ATvSAiQoKr_d7NuPgAtOQo%252F1%252FhfBMJEBrIic7RCNqnNl7qw%252FaHR0c

Output:
- Domain: public-usa.mkt.dynamics.com
- Domain: 1wlh8.mjt.lu
- URL: https://public-usa.mkt.dynamics.com/api/orgs/...
- URL: https://1wlh8.mjt.lu/lnk/AcUAABqoEPAAAAAAAAAAA9_1jiMAAYKIuGIAAAAAADGEKQBowmAFZJy84ATvSAiQoKr_d7NuPgAtOQo/1/hfBMJEBrIic7RCNqnNl7qw/aHR0c
```

**Multiple Encoding Layers:**
```
Input:  %252F%252F → %2F%2F → //
Input:  %2528 → %28 → (
```

## Technical Details

- Uses Chrome Extension Manifest V3
- Implements proper CSP-compliant event handling
- Local storage for snippets and settings
- Modern JavaScript with async/await patterns
- Recursive URL decoding with safety limits
- Advanced regex patterns for IOC extraction