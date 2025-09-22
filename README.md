
# SOC Analyst Toolkit

A browser extension for security operations center (SOC) analysts and cybersecurity professionals to streamline the analysis of indicators of compromise (IOCs).

## Overview

This extension provides a suite of tools to accelerate the investigation of security alerts. It extracts IOCs (IPs, domains, URLs, hashes, etc.) from selected text, provides quick links to popular OSINT services, and includes text manipulation utilities for common analyst tasks. All processing is done locally in the browser for privacy and security.

## Features

- **IOC Extraction**: Automatically finds and parses IOCs from any text.
- **OSINT Integration**: Right-click any selected text to look it up in services like VirusTotal, AbuseIPDB, and more.
- **Text Processing Tools**: Includes utilities for URL decoding, Base64/Hex decoding, and IOC defanging.
- **Snippet Library**: A personal, searchable library for frequently used notes and commands, accessible from the popup.
- **Privacy-Focused**: All data is processed and stored locally in your browser. No external data transmission or tracking.

## Installation

1. Open your browser and navigate to `chrome://extensions/`.
2. Enable "Developer mode".
3. Click "Load unpacked" and select the directory containing this project's files.
4. Pin the extension to your toolbar for easy access.

## Usage

- **IOC Analysis**: Select text on any webpage and right-click to "Analyze with SOC Toolkit". The popup will open with the extracted IOCs.
- **OSINT Lookups**: Select an IOC and right-click to open it directly in an OSINT tool.
- **Snippet Access**: Click the extension icon in your toolbar to open the popup and access the snippet library.

## Technical Details

- **Manifest Version**: 3
- **Permissions**: `storage`, `clipboardWrite`, `contextMenus`, `notifications`, `activeTab`.
- **Storage**: Uses local browser storage for all user data.

## Contributing

Contributions are welcome. Please feel free to submit bug reports, feature requests, or pull requests.

## License

See the LICENSE file for details.
