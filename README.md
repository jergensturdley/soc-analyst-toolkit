# SOC Analyst Toolkit - Chrome Extension

A comprehensive Chrome extension for SOC analysts featuring IOC analysis, snippet management, and browser-wide text expansion capabilities.

## 🚀 Features

### 🔍 IOC Analysis

- **Intelligent IOC Extraction**: Automatically detects IPs, domains, URLs, emails, and file hashes
- **OSINT Integration**: One-click links to VirusTotal, Hybrid Analysis, URLVoid, and more
- **Smart Defanging**: Converts defanged IOCs back to usable format
- **Multi-layer Decoding**: Handles complex URL encoding and embedded URLs
- **Copy & Export**: Easy copying and bulk export in multiple formats

### 📝 Enhanced Snippet Management

- **Browser-Wide Expansion**: Snippets work in any input field across all websites
- **Global Keyboard Shortcuts**:
  - `Ctrl+Shift+Space`: Show snippet overlay anywhere
  - `Ctrl+Shift+T`: Toggle snippet expansion on/off
- **Smart Triggers**: Customizable prefixes (default: `$` and `:`)
- **Variable Replacement**: Dynamic content with date/time variables
- **Import/Export**: Share snippet collections with your team

### 🌐 Universal Compatibility

- Works in Gmail, Slack, JIRA, ticketing systems, and any web application
- Supports standard inputs, textareas, and contenteditable elements
- Compatible with popular code editors (Monaco, Ace, CodeMirror)

## 📦 Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked" and select the extension folder
4. Pin the extension to your toolbar for easy access

## 🎯 Usage Examples

### IOC Analysis Examples

**Malicious Email Analysis:**

```text
From: security-alert@paypal-verify.suspicious-domain.com
Subject: Urgent: Verify Your Account

Suspicious URLs found:
- hxxps[://]paypal-verify[.]suspicious-domain[.]com/login
- hxxp[://]192[.]168[.]1[.]100/payload.exe

File hashes:
- MD5: 5d41402abc4b2a76b9719d911017c592
- SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

**Phishing URL Decoding:**

```text
Input: 
https://suspicious-site.com/redirect?url=%68%74%74%70%73%3A%2F%2F%6D%61%6C%77%61%72%65%2D%73%69%74%65%2E%63%6F%6D

Output:
- Decoded URL: https://malware-site.com
- Domain: suspicious-site.com
- Domain: malware-site.com
```

**Network Traffic Analysis:**

```text
Log entry: 
2023-09-14 10:30:45 TCP 192.168.1.100:443 -> 203.0.113.42:80 malware.example[.]com

Extracted IOCs:
- IP: 192.168.1.100
- IP: 203.0.113.42  
- Domain: malware.example.com
- Port: 443, 80
```

### Snippet Examples

**Incident Response Templates:**

*Trigger: `$incident-summary`*

```markdown
## Incident Summary
- **Date/Time**: ${CURRENT_DATE} ${CURRENT_TIME}
- **Analyst**: [Your Name]
- **Severity**: [Critical/High/Medium/Low]
- **Status**: [Open/In Progress/Resolved]
- **Affected Systems**: 

## Timeline
- **${CURRENT_TIME}**: Initial detection
- 

## IOCs Identified
- 

## Actions Taken
- 

## Recommendations
- 
```

*Trigger: `$email-analysis`*

```markdown
## Email Analysis Report
**Subject**: 
**From**: 
**To**: 
**Date**: ${CURRENT_DATE}

### Headers Analysis
- SPF: 
- DKIM: 
- DMARC: 

### Attachment Analysis
- File Name: 
- File Hash: 
- VirusTotal Score: 

### URL Analysis
- Suspicious URLs: 
- Redirect Chains: 

### Verdict: [Malicious/Suspicious/Clean]
```

*Trigger: `$malware-analysis`*

```markdown
## Malware Analysis Summary
**Sample**: 
**MD5**: 
**SHA256**: 
**File Type**: 
**Size**: 
**Analysis Date**: ${CURRENT_DATE}

### Static Analysis
- Packer: 
- Strings: 
- Imports: 

### Dynamic Analysis
- Network Activity: 
- File System Changes: 
- Registry Modifications: 

### MITRE ATT&CK Mapping
- Tactics: 
- Techniques: 

### IOCs
- 
```

**OSINT Investigation Templates:**

*Trigger: `$domain-intel`*
```
## Domain Intelligence Report
**Domain**: 
**Analysis Date**: ${CURRENT_DATE}

### WHOIS Information
- Registrar: 
- Creation Date: 
- Expiration Date: 
- Registrant: 

### DNS Records
- A Record: 
- MX Record: 
- NS Record: 

### Reputation Checks
- VirusTotal: /10 vendors flagged
- URLVoid: /10 blacklists
- Hybrid Analysis: 

### Related Domains
- 
```

*Trigger: `$ip-intel`*
```
## IP Address Intelligence
**IP Address**: 
**Analysis Date**: ${CURRENT_DATE}

### Geolocation
- Country: 
- City: 
- ISP: 
- Organization: 

### Reputation
- AbuseIPDB Score: 
- VirusTotal Detections: 
- Shodan Services: 

### Network Information
- ASN: 
- CIDR Block: 
- Route: 

### Threat Intelligence
- Known Campaigns: 
- Malware Families: 
```

**Communication Templates:**

*Trigger: `$alert-escalation`*
```
## Security Alert Escalation
**To**: Security Manager
**Priority**: HIGH
**Date**: ${CURRENT_DATE}

### Summary
Critical security incident requiring immediate attention.

### Details
- **Alert Type**: 
- **Affected Assets**: 
- **Potential Impact**: 
- **Evidence**: 

### Immediate Actions Required
1. 
2. 
3. 

### Next Steps
- 
```

*Trigger: `$user-notification`*
```
## Security Incident Notification
**Dear [User Name]**,

Our security team has identified suspicious activity that may affect your account.

### What Happened
- 

### What We're Doing
- 

### What You Should Do
1. 
2. 
3. 

If you have any questions, please contact the Security Operations Center.

Best regards,
SOC Team
```

## ⌨️ Keyboard Shortcuts

- `Ctrl+Shift+S` (or `Cmd+Shift+S`): Open SOC Toolkit
- `Ctrl+Shift+Space`: Show snippet overlay (works anywhere)
- `Ctrl+Shift+T`: Toggle snippet expansion on/off

## 🔧 Configuration

### Snippet Prefixes

Customize trigger prefixes in the Snippets tab:

- Default: `$` and `:`
- Examples: `$incident`, `:template`, `#snippet`

### Auto-Analysis

Enable/disable automatic IOC analysis as you type in the IOC Analysis tab.

## 🤝 Team Collaboration

### Sharing Snippets

1. Export your snippet collection using the Export button
2. Share the JSON file with team members
3. Team members can import using the Import button

### Standardized Templates

Use consistent snippet triggers across your team:

- `$incident-*` for incident response templates
- `$analysis-*` for analysis reports
- `$comm-*` for communication templates

## 🛠️ Technical Details

- **Manifest Version**: 3 (Latest Chrome extension standard)
- **Permissions**: Storage, clipboard, context menus, active tab
- **Compatibility**: Chrome, Chromium-based browsers
- **Storage**: Local browser storage (secure and private)
- **Performance**: Lightweight with minimal memory footprint

## 🔒 Privacy & Security

- All data stored locally in your browser
- No external data transmission
- No telemetry or tracking
- Open source for transparency and security review

## 📈 Updates & Roadmap

### Recent Enhancements

- ✅ Browser-wide snippet expansion
- ✅ Global keyboard shortcuts
- ✅ Improved popup sizing
- ✅ Enhanced IOC parsing

### Planned Features

- 🔄 Team snippet synchronization
- 🔄 Custom OSINT source integration
- 🔄 Advanced IOC correlation
- 🔄 Threat hunting templates

## 🤝 Contributing

We welcome contributions! Please see our [GitHub repository](https://github.com/jergensturdley/soc-analyst-toolkit) for:

- Bug reports
- Feature requests
- Code contributions
- Documentation improvements

## 📄 License

This project is open source. See the LICENSE file for details.
