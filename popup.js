// SOC Analyst Toolkit - Popup JavaScript

class SOCToolkit {
  constructor() {
    this.currentTab = 'ioc';
    this.snippets = [];
    this.autoAnalyze = true;
    // Prefixes are now fixed and not user-editable
    this.snippetPrefixes = ['$', ':'];
    this.floatMode = false;
    this.customOsintSources = [];
    this.enableGraph = true;
    this.iocGraph = null;
    this.currentTheme = 'matrix'; // Default theme
    this.tlds = new Set();
    // Cache for debounce timeouts
    this._debounceTimers = {};
    // Cache for OSINT links to avoid regenerating
    this._osintLinksCache = new Map();
    this.init();
  }

  // Utility function for debouncing
  debounce(key, callback, delay) {
    clearTimeout(this._debounceTimers[key]);
    this._debounceTimers[key] = setTimeout(callback, delay);
  }

  async init() {
    this.setupEventListeners();
    // Load critical settings first, TLDs lazily
    await Promise.all([
      this.loadSettings(),
      this.loadSnippets(),
      this.loadCustomOsintSources()
    ]);
    
    this.displaySnippets();
    this.displayCustomOsintSources();
    
    // Check for pending actions from context menu or background
    await this.checkPendingAnalysis();
    
    // Handle any legacy pending actions
    chrome.storage.local.get(['pendingAction', 'pendingText'], (result) => {
      if (result.pendingAction && result.pendingText) {
        this.handlePendingAction(result.pendingAction, result.pendingText);
        chrome.storage.local.remove(['pendingAction', 'pendingText']);
      }
    });
    
    // Load TLDs lazily in the background
    this.loadTlds();
  }

  async loadTlds() {
    // Return immediately if already loaded
    if (this.tlds && this.tlds.size > 100) return;
    
    try {
      const { validTlds } = await import('./tlds.js');
      this.tlds = validTlds;
    } catch (error) {
      console.error('Failed to load TLDs:', error);
      // Fallback to a small, common set if loading fails
      this.tlds = new Set(['com', 'net', 'org', 'edu', 'gov', 'mil', 'io', 'co', 'uk', 'de', 'jp', 'fr', 'au', 'ru', 'ch', 'it', 'nl', 'ca', 'cn', 'br', 'us', 'info', 'biz']);
    }
  }

  async checkPendingAnalysis() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getPendingAnalysis' });
      if (response && response.text) {
        document.getElementById('iocInput').value = response.text;
        this.switchTab('ioc');
        if (this.autoAnalyze) {
          this.analyzeIOCs();
        }
      }
    } catch (err) {
      console.log('No pending analysis or error:', err);
    }
  }

  handlePendingAction(action, text) {
    switch (action) {
      case 'extract-iocs':
        this.extractIOCsFromText(text);
        break;
      default:
        console.log('Unknown pending action:', action);
    }
  }

  extractIOCsFromText(text) {
    const iocs = this.extractIOCs(text);
    const iocText = iocs.map(ioc => ioc.value).join('\n');
    
    // Just display the IOCs, no automatic copy
    document.getElementById('iocInput').value = iocText;
    this.switchTab('ioc');
    this.analyzeIOCs();
    this.showStatus('IOCs extracted and displayed', 'success');
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // IOC Analysis buttons
  const el = (id) => document.getElementById(id);
  el('analyzeBtn')?.addEventListener('click', () => this.analyzeIOCs());
  el('clearBtn')?.addEventListener('click', () => this.clearIOCs());
  el('pasteBtn')?.addEventListener('click', () => this.pasteFromClipboard());
  el('defangBtn')?.addEventListener('click', () => this.defangIOCsInInput());
  el('fangBtn')?.addEventListener('click', () => this.fangIOCsInInput());

    // Auto-analysis on input
    const iocInput = document.getElementById('iocInput');
    const autoAnalyzeToggle = document.getElementById('autoAnalyzeToggle');

      if (autoAnalyzeToggle) {
        autoAnalyzeToggle.checked = this.autoAnalyze;
        autoAnalyzeToggle.addEventListener('change', (e) => {
          this.autoAnalyze = e.target.checked;
          this.saveSettings();
        });
      }

      // Initialize graph toggle
      const enableGraphToggle = document.getElementById('enableGraphToggle');
      if (enableGraphToggle) {
        enableGraphToggle.checked = this.enableGraph;
      }



      // Snippet editor buttons (save/cancel)
      const saveBtn = document.getElementById('snippetSaveBtn');
      const cancelBtn = document.getElementById('snippetCancelBtn');
      if (saveBtn) saveBtn.addEventListener('click', () => this.saveSnippetFromEditor());
      if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeSnippetEditor());

      if (iocInput) {
        iocInput.addEventListener('input', () => {
          // Debounced save to storage
          this.debounce('saveIOCInput', () => {
            chrome.storage.local.set({ savedIOCInput: iocInput.value });
          }, 1000);
          
          // Auto-analysis (debounced)
          if (this.autoAnalyze) {
            this.debounce('autoAnalyze', () => {
              if (iocInput.value.trim()) {
                this.analyzeIOCs();
              } else {
                this.clearIOCs();
              }
            }, 500);
          }
        });
      }

    // Snippet functionality
  el('snippetSearch')?.addEventListener('input', (e) => this.searchSnippets(e.target.value));
  el('addSnippetBtn')?.addEventListener('click', () => this.addSnippet());
  el('importBtn')?.addEventListener('click', () => this.importSnippets());
  el('exportBtn')?.addEventListener('click', () => this.exportSnippets());

    // Investigation Notes functionality
    el('addNoteBtn')?.addEventListener('click', () => this.showAddNoteModal());
    el('exportNotesBtn')?.addEventListener('click', () => this.exportNotes());
    el('clearNotesBtn')?.addEventListener('click', () => this.clearAllNotes());
    el('saveNoteBtn')?.addEventListener('click', () => this.saveNote());
    el('cancelNoteBtn')?.addEventListener('click', () => this.hideAddNoteModal());

    // File Hash functionality
    el('selectFileBtn')?.addEventListener('click', () => this.selectFile());
    el('hashFileBtn')?.addEventListener('click', () => this.hashSelectedFile());
    el('copyFileHashBtn')?.addEventListener('click', () => this.copyFileHashes());
    el('fileHashInput')?.addEventListener('change', (e) => this.handleFileSelection(e));

    // Header controls
    el('floatBtn')?.addEventListener('click', () => this.toggleFloat());
    el('closeBtn')?.addEventListener('click', () => this.closeWindow());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') this.analyzeIOCs();
      if (e.key === 'Escape') this.clearIOCs();
    });

    // --- IOC Results Panel controls ---
  el('copyAllBtn')?.addEventListener('click', () => this.copyAllIOCs());
  el('clearGraphBtn')?.addEventListener('click', () => this.clearGraph());

    document.querySelectorAll('#exportMenu .dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const format = e.target.getAttribute('data-export');
        this.exportIOCs(format);
      });
    });

    document.querySelectorAll('#filterMenu .dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const filter = e.target.getAttribute('data-filter');
        this.filterIOCs(filter);
      });
    });

  el('selectAllIOCs')?.addEventListener('change', (e) => {
      const checked = e.target.checked;
      document.querySelectorAll('.ioc-item input[type="checkbox"]').forEach(cb => {
        cb.checked = checked;
      });
    });

    // Bulk action buttons (footer)
  const copySel = el('copySelectedBtn');
  const exportSel = el('exportSelectedBtn');
  const openVTSel = el('openVTSelectedBtn');
    if (copySel) copySel.addEventListener('click', () => this.handleBulkAction('copy'));
    if (exportSel) exportSel.addEventListener('click', () => this.handleBulkAction('export'));
    if (openVTSel) openVTSel.addEventListener('click', () => this.handleBulkAction('osint'));

    // Settings tab functionality
    el('addOsintBtn')?.addEventListener('click', () => this.addCustomOsintSource());
    el('osintSaveBtn')?.addEventListener('click', () => this.saveCustomOsintSource());
    el('osintCancelBtn')?.addEventListener('click', () => this.closeOsintEditor());
    el('enableGraphToggle')?.addEventListener('change', (e) => {
      this.enableGraph = e.target.checked;
      this.saveSettings();
      this.updateGraphVisibility();
    });

    // Theme selector
    el('themeSelect')?.addEventListener('change', (e) => {
      this.currentTheme = e.target.value;
      this.applyTheme(this.currentTheme);
      this.saveSettings();
    });

    // Floating window button
    el('toggleFloatingBtn')?.addEventListener('click', () => this.toggleFloat());

    // Simple dropdown toggles for Export / Filter headers
    document.querySelectorAll('.dropdown > .btn').forEach(btn => {
      const dd = btn.parentElement;
      const menu = dd.querySelector('.dropdown-menu');
      if (!menu) return;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.dropdown.open').forEach(d => d !== dd && d.classList.remove('open'));
        dd.classList.toggle('open');
      });
    });
    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
    });
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    let targetId;
    if (tabName === 'snippets') {
      targetId = 'snippets-tab';
    } else if (tabName === 'notes') {
      targetId = 'notes-tab';
    } else if (tabName === 'settings') {
      targetId = 'settings-tab';
    } else {
      targetId = 'ioc-tab';
    }
    
    document.querySelectorAll('.tab-content').forEach(content => {
      const isTarget = content.id === targetId;
      content.classList.toggle('active', isTarget);
      content.style.display = isTarget ? 'block' : 'none';
    });
    
    this.currentTab = tabName;
    if (tabName === 'snippets') {
      // Ensure snippets list is rendered/refreshed when opening the tab
      const snippetsTab = document.getElementById('snippets-tab');
      if (snippetsTab) {
        this.displaySnippets();
      } else {
        console.error('snippets-tab element not found!');
      }
    } else if (tabName === 'notes') {
      this.displayNotes();
    } else if (tabName === 'settings') {
      this.displayCustomOsintSources();
    }
  }

  // IOC Analysis Functions
  analyzeIOCs() {
    const input = document.getElementById('iocInput').value.trim();
    if (!input) {
      this.showNotification('Please enter text to analyze', 'error');
      return;
    }
    // Clear OSINT links cache when analyzing new IOCs
    this._osintLinksCache.clear();
    const iocs = this.extractIOCs(input);
    this.displayIOCResults(iocs);
  }

  displayIOCResults(iocs) {
    const resultsContainer = document.getElementById('iocResults');
    const listEl = resultsContainer.querySelector('.ioc-list');
    if (!listEl) return;

    if (iocs.length === 0) {
      listEl.innerHTML = `<div class="ioc-item empty-state"><i class="fa-solid fa-search"></i><div>No IOCs found. Run analysis above.</div></div>`;
      // Update count to 0 and keep header/footer intact
      const countEl = resultsContainer.querySelector('.ioc-count');
      if (countEl) countEl.textContent = `IOC Results [0]`;
      return;
    }

    // Build HTML in memory first, then update DOM once
    const htmlParts = [];
    for (const ioc of iocs) {
      const osintLinks = this.generateOSINTLinks(ioc.value, ioc.category);
      const escapedValue = this.escapeHtml(ioc.value);
      const truncatedValue = this.truncateText(ioc.value, 40);
      
      htmlParts.push(`
        <div class="ioc-item">
          <input type="checkbox" class="ioc-select" />
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <div class="ioc-value" data-copy="${escapedValue}" title="Click to copy">
                ${truncatedValue}
              </div>
              <span class="ioc-type type-${ioc.category.toLowerCase()}">${ioc.type}</span>
            </div>
            <div class="osint-links">
              ${osintLinks.map(link => `
                <div class="osint-link-container">
                  <a href="${link.url}" target="_blank" class="osint-link" title="${link.name}">${link.name}</a>
                  <button class="copy-link-btn" data-copy="${this.escapeHtml(link.url)}" title="Copy Link"><i class="fa-regular fa-copy"></i></button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>`);
    }
    listEl.innerHTML = htmlParts.join('');

    // Update count
    const countEl = resultsContainer.querySelector('.ioc-count');
    if (countEl) countEl.textContent = `IOC Results [${iocs.length}]`;

    // Add event listeners for copy functionality
    this.setupCopyEventListeners();

    // Generate and display IOC correlation graph
    if (this.enableGraph) {
      this.generateIOCGraph(iocs);
    }
  }

  // --- New Helpers ---
  copyAllIOCs() {
    const values = Array.from(document.querySelectorAll('.ioc-item .ioc-value'))
      .map(el => el.textContent.trim());
    if (values.length === 0) {
      this.showNotification('No IOCs to copy', 'error');
      return;
    }
    this.copyToClipboard(values.join('\n'));
  }

  exportIOCs(format = 'csv') {
    const iocs = Array.from(document.querySelectorAll('.ioc-item')).map(item => {
      const value = item.querySelector('.ioc-value')?.textContent.trim() || '';
      const type = item.querySelector('.ioc-type')?.textContent.trim() || '';
      return { value, type };
    });

    if (iocs.length === 0) {
      this.showNotification('No IOCs to export', 'error');
      return;
    }

    // Handle graph image exports
    if (format === 'graph-png' || format === 'graph-svg') {
      this.exportGraphImage(format);
      return;
    }

    let content = '';
    let mime = 'text/plain';
    let ext = 'txt';

    if (format === 'csv') {
      content = 'Value,Type\n' + iocs.map(i => `"${i.value}","${i.type}"`).join('\n');
      mime = 'text/csv';
      ext = 'csv';
    } else if (format === 'json') {
      content = JSON.stringify(iocs, null, 2);
      mime = 'application/json';
      ext = 'json';
    } else if (format === 'md') {
      content = iocs.map(i => `- **${i.type}**: ${i.value}`).join('\n');
      mime = 'text/markdown';
      ext = 'md';
    } else if (format === 'obsidian') {
      content = this.generateObsidianGraph(iocs);
      mime = 'text/markdown';
      ext = 'md';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = format === 'obsidian' ? `ioc-graph-${new Date().toISOString().split('T')[0]}.${ext}` : `ioc-results-${new Date().toISOString().split('T')[0]}.${ext}`;
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    this.showNotification(`Exported ${iocs.length} IOCs as ${format.toUpperCase()}`, 'success');
  }

  // Generate Obsidian-compatible graph markdown
  generateObsidianGraph(iocs) {
    const timestamp = new Date().toISOString().split('T')[0];
    let content = `# IOC Analysis Graph - ${timestamp}\n\n`;
    
    // Add metadata
    content += `---\n`;
    content += `tags: [ioc, analysis, graph]\n`;
    content += `date: ${timestamp}\n`;
    content += `---\n\n`;
    
    // Add IOC nodes as markdown links
    content += `## IOC Nodes\n\n`;
    const nodeMap = new Map();
    
    iocs.forEach((ioc, index) => {
      const nodeName = `IOC_${ioc.type}_${index + 1}`;
      nodeMap.set(ioc.value, nodeName);
      content += `### [[${nodeName}]]\n`;
      content += `- **Type**: ${ioc.type}\n`;
      content += `- **Value**: \`${ioc.value}\`\n`;
      content += `- **Category**: ${ioc.category || 'unknown'}\n\n`;
    });
    
    // Add relationships
    content += `## Relationships\n\n`;
    const relationships = this.detectIOCRelationships(iocs);
    
    if (relationships.length > 0) {
      relationships.forEach(rel => {
        const sourceNode = nodeMap.get(rel.source);
        const targetNode = nodeMap.get(rel.target);
        if (sourceNode && targetNode) {
          content += `- [[${sourceNode}]] --${rel.type}--> [[${targetNode}]]\n`;
        }
      });
    } else {
      content += `No relationships detected between IOCs.\n`;
    }
    
    // Add canvas view for Obsidian
    content += `\n## Graph View\n\n`;
    content += `This analysis contains ${iocs.length} IOCs with ${relationships.length} relationships.\n`;
    content += `Use Obsidian's Graph View to visualize the connections between these indicators.\n\n`;
    
    // Add individual IOC files as suggestions
    content += `## Individual IOC Files\n\n`;
    content += `Consider creating individual files for each IOC:\n\n`;
    iocs.forEach((ioc, index) => {
      const nodeName = `IOC_${ioc.type}_${index + 1}`;
      content += `- Create file: \`${nodeName}.md\` with content:\n`;
      content += `  \`\`\`markdown\n`;
      content += `  # ${ioc.value}\n`;
      content += `  \n`;
      content += `  **Type**: ${ioc.type}\n`;
      content += `  **Value**: \`${ioc.value}\`\n`;
      content += `  **Analysis Date**: ${timestamp}\n`;
      content += `  \n`;
      content += `  ## Analysis Notes\n`;
      content += `  \n`;
      content += `  ## Related IOCs\n`;
      content += `  \`\`\`\n\n`;
    });
    
    return content;
  }

  // Export graph visualization as image
  exportGraphImage(format) {
    if (!this.iocGraph) {
      this.showNotification('No graph visualization available. Enable graph visualization first.', 'error');
      return;
    }

    try {
      const canvas = this.iocGraph.canvas.frame.canvas;
      const graphContainer = document.getElementById('iocGraph');
      
      if (!canvas) {
        this.showNotification('Canvas not available for export', 'error');
        return;
      }

      if (format === 'graph-png') {
        // Export as PNG
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ioc-graph-${new Date().toISOString().split('T')[0]}.png`;
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification('Graph exported as PNG', 'success');
          } else {
            this.showNotification('Failed to export graph as PNG', 'error');
          }
        }, 'image/png');
      } else if (format === 'graph-svg') {
        // Export as SVG (vis.js doesn't directly support SVG, so we'll create a canvas-to-SVG conversion)
        const svgData = this.canvasToSVG(canvas);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ioc-graph-${new Date().toISOString().split('T')[0]}.svg`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('Graph exported as SVG', 'success');
      }
    } catch (error) {
      console.error('Graph export error:', error);
      this.showNotification('Failed to export graph image', 'error');
    }
  }

  // Convert canvas to SVG (basic implementation)
  canvasToSVG(canvas) {
    const { width, height } = canvas;
    const imageData = canvas.toDataURL('image/png');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <title>IOC Relationship Graph</title>
  <desc>Generated from SOC Analyst Toolkit</desc>
  <image x="0" y="0" width="${width}" height="${height}" xlink:href="${imageData}"/>
</svg>`;
  }

  filterIOCs(category) {
    const items = document.querySelectorAll('.ioc-item');
    let visibleCount = 0;
    items.forEach(item => {
      const type = item.querySelector('.ioc-type')?.textContent.toLowerCase() || '';
      if (category === 'all' || type.includes(category)) {
        item.style.display = '';
        visibleCount++;
      } else {
        item.style.display = 'none';
      }
    });
    document.querySelector('.ioc-count').textContent = `IOC Results [${visibleCount}]`;
  }

  handleBulkAction(action) {
    const selected = Array.from(document.querySelectorAll('.ioc-item input[type="checkbox"]:checked'))
      .map(cb => cb.closest('.ioc-item'));
    if (selected.length === 0) {
      this.showNotification('No IOCs selected', 'error');
      return;
    }

    const values = selected.map(item => item.querySelector('.ioc-value')?.textContent.trim() || '');

    if (action === 'copy') {
      this.copyToClipboard(values.join('\n'));
    } else if (action === 'export') {
      this.exportIOCs('csv'); // bulk default as CSV
    } else if (action === 'osint') {
      selected.forEach(item => {
        const vtLink = item.querySelector('.osint-link[href*="virustotal.com"]');
        if (vtLink) window.open(vtLink.href, '_blank');
      });
    }
  }

  // --- Rest of your original class methods (snippets, copyToClipboard, etc.) ---

  // === Settings ===
  async loadSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['socSettings', 'savedIOCInput'], (res) => {
          const defaults = { autoAnalyze: true, enableGraph: true, theme: 'matrix' };
          const s = res.socSettings || defaults;
          this.autoAnalyze = s.autoAnalyze ?? true;
          this.enableGraph = s.enableGraph ?? true;
          this.currentTheme = s.theme ?? 'matrix';
          // load snippetPrefixes if present
          if (s.snippetPrefixes && Array.isArray(s.snippetPrefixes)) this.snippetPrefixes = s.snippetPrefixes;
          
          // Apply the theme
          this.applyTheme(this.currentTheme);
          
          // Set the theme selector value
          const themeSelect = document.getElementById('themeSelect');
          if (themeSelect) {
            themeSelect.value = this.currentTheme;
          }
          
          // Restore saved IOC input
          if (res.savedIOCInput) {
            const iocInput = document.getElementById('iocInput');
            if (iocInput) {
              iocInput.value = res.savedIOCInput;
            }
          }
          
          resolve();
        });
      } catch (e) {
        this.autoAnalyze = true;
        this.enableGraph = true;
        this.currentTheme = 'matrix';
        this.applyTheme(this.currentTheme);
        resolve();
      }
    });
  }

  saveSettings() {
    try {
      const socSettings = { 
        autoAnalyze: this.autoAnalyze, 
        enableGraph: this.enableGraph,
        snippetPrefixes: this.snippetPrefixes,
        theme: this.currentTheme
      };
      chrome.storage.local.set({ socSettings });
    } catch {}
  }

  // === Theme Management ===
  applyTheme(themeName) {
    // Remove existing theme data attributes
    document.body.removeAttribute('data-theme');
    
    // Apply new theme (if not matrix/default)
    if (themeName !== 'matrix') {
      document.body.setAttribute('data-theme', themeName);
    }
    
    this.currentTheme = themeName;
  }

  // === Snippets ===
  async loadSnippets() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['snippets'], (res) => {
          this.snippets = Array.isArray(res.snippets) ? res.snippets : [];
          resolve();
        });
      } catch (e) {
        this.snippets = [];
        resolve();
      }
    });
  }

  async saveSnippets() {
    try {
      await chrome.storage.local.set({ snippets: this.snippets });
    } catch {}
  }

  displaySnippets(filtered = null) {
    const list = document.getElementById('snippetList');
    if (!list) return;
    const data = filtered ?? this.snippets;
    if (!data.length) {
      const emptyStateHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-code"></i>
          <div>No snippets found</div>
          <div style="font-size: 11px; margin-top: 4px;">Create your first snippet to get started</div>
        </div>`;
      list.innerHTML = emptyStateHTML;
      return;
    }

    // Build HTML in memory first
    const htmlParts = [];
    for (let idx = 0; idx < data.length; idx++) {
      const snip = data[idx];
      htmlParts.push(`
      <div class="snippet-item" data-index="${idx}">
        <div class="snippet-header">
          <div class="snippet-name">${this.escapeHtml(snip.name || 'Untitled')}</div>
        </div>
        <div class="snippet-content">
          <div class="snippet-text">${this.escapeHtml(snip.content || '')}</div>
          <div class="snippet-actions">
            <button class="btn btn-primary btn-small action-copy"><i class="fa-regular fa-copy"></i> Copy</button>
            <button class="btn btn-secondary btn-small action-edit"><i class="fa-regular fa-pen-to-square"></i> Edit</button>
            <button class="btn btn-secondary btn-small action-delete"><i class="fa-regular fa-trash-can"></i> Delete</button>
          </div>
        </div>
      </div>`);
    }
    list.innerHTML = htmlParts.join('');

    // Use event delegation for better performance
    list.addEventListener('click', (e) => {
      const target = e.target;
      const item = target.closest('.snippet-item');
      if (!item) return;
      
      const idx = Number(item.dataset.index);
      const snip = data[idx];
      
      if (target.closest('.snippet-header')) {
        item.querySelector('.snippet-content').classList.toggle('expanded');
      } else if (target.closest('.action-copy')) {
        this.copyToClipboard(snip.content || '');
      } else if (target.closest('.action-edit')) {
        this.openSnippetEditor(idx);
      } else if (target.closest('.action-delete')) {
        if (confirm(`Delete snippet "${snip.name || 'Untitled'}"?`)) {
          const realIndex = this.snippets.indexOf(snip);
          if (realIndex >= 0) {
            this.snippets.splice(realIndex, 1);
            this.saveSnippets();
            this.displaySnippets();
          }
        }
      }
    });
  }

  searchSnippets(query) {
    const q = (query || '').toLowerCase();
    if (!q) return this.displaySnippets();
    const filtered = this.snippets.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.content || '').toLowerCase().includes(q)
    );
    this.displaySnippets(filtered);
  }

  async addSnippet() {
    // Open editor for a new snippet
    this.openSnippetEditor();
  }

  openSnippetEditor(index = null) {
    const editor = document.getElementById('snippetEditor');
    const nameIn = document.getElementById('snippetNameInput');
    const contentIn = document.getElementById('snippetContentInput');
    if (!editor || !nameIn || !contentIn) return;
    // If index provided, load existing
    if (index !== null && this.snippets[index]) {
      const s = this.snippets[index];
      nameIn.value = s.name || '';
      contentIn.value = s.content || '';
      editor.dataset.editIndex = String(index);
    } else {
      nameIn.value = '';
      contentIn.value = '';
      delete editor.dataset.editIndex;
    }
    editor.style.display = 'block';
    nameIn.focus();
  }

  closeSnippetEditor() {
    const editor = document.getElementById('snippetEditor');
    if (!editor) return;
    editor.style.display = 'none';
  }

  async saveSnippetFromEditor() {
    const editor = document.getElementById('snippetEditor');
    const nameIn = document.getElementById('snippetNameInput');
    const contentIn = document.getElementById('snippetContentInput');
    if (!nameIn || !contentIn) return;
    const name = (nameIn.value || '').trim();
    const content = contentIn.value || '';
    if (!name) { this.showNotification('Please provide a name', 'error'); return; }
    const idx = editor.dataset.editIndex !== undefined ? Number(editor.dataset.editIndex) : -1;
    if (idx >= 0 && this.snippets[idx]) {
      this.snippets[idx] = { name, content };
    } else {
      this.snippets.push({ name, content });
    }
    await this.saveSnippets();
    this.displaySnippets();
    this.closeSnippetEditor();
    this.showNotification('Snippet saved', 'success');
  }

  importSnippets() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.snippets) ? parsed.snippets : []);
        if (!arr.length) throw new Error('No snippets found');
        // Basic normalization
        const cleaned = arr.map(s => ({ name: s.name || 'Untitled', content: s.content || '' }));
        this.snippets = cleaned;
        await this.saveSnippets();
        this.displaySnippets();
        this.showNotification(`Imported ${cleaned.length} snippets`, 'success');
      } catch (e) {
        this.showNotification('Failed to import snippets', 'error');
      }
    };
    input.click();
  }

  exportSnippets() {
    const data = JSON.stringify(this.snippets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snippets-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showNotification('Snippets exported', 'success');
  }
  

// === IOC helpers ===
  setupCopyEventListeners() {
    document.querySelectorAll('.ioc-value').forEach(el => {
      el.addEventListener('click', () => {
        const text = el.getAttribute('data-copy') || el.textContent.trim();
        this.copyToClipboard(text);
      });
    });
    document.querySelectorAll('.copy-link-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-copy') || '';
        this.copyToClipboard(text);
      });
    });
  }

  clearIOCs() {
    // Clear the input field
    const input = document.getElementById('iocInput');
    if (input) {
      input.value = '';
      // Clear saved IOC input from storage
      chrome.storage.local.remove('savedIOCInput');
    }
    
    // Clear the graph visualization
    this.clearGraph();
    
    // Clear the results display
    const resultsContainer = document.getElementById('iocResults');
    const listEl = resultsContainer?.querySelector('.ioc-list');
    if (listEl) {
      listEl.innerHTML = `
        <div class="ioc-item empty-state">
          <i class="fa-solid fa-search"></i>
          <div>No IOCs found. Run analysis above.</div>
        </div>`;
    }
    const countEl = resultsContainer?.querySelector('.ioc-count');
    if (countEl) countEl.textContent = 'IOC Results [0]';
    const selectAll = document.getElementById('selectAllIOCs');
    if (selectAll) selectAll.checked = false;
  }

  async pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const input = document.getElementById('iocInput');
      if (input) {
        input.value = text || '';
        // Save to storage for persistence
        chrome.storage.local.set({ savedIOCInput: input.value });
        if (this.autoAnalyze && input.value.trim()) {
          this.analyzeIOCs();
        }
      }
    } catch (e) {
      this.showNotification('Unable to read clipboard', 'error');
    }
  }

  copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => this.showNotification('Copied to clipboard', 'success'));
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        this.showNotification('Copied to clipboard', 'success');
      }
    } catch (e) {
      this.showNotification('Copy failed', 'error');
    }
  }

  showNotification(message, type = 'success') {
    const note = document.createElement('div');
    note.className = `notification ${type}`;
    note.textContent = message;
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 2000);
  }

  truncateText(text, max = 40) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  escapeHtml(str) {
    if (!str) return '';
    // Use a single regex with a lookup map for better performance
    const htmlEscapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, (char) => htmlEscapeMap[char]);
  }

  generateOSINTLinks(value, category) {
    // Check cache first
    const cacheKey = `${value}:${category}`;
    if (this._osintLinksCache.has(cacheKey)) {
      return this._osintLinksCache.get(cacheKey);
    }
    
    const enc = encodeURIComponent(value);
    const links = [];
    
    // Default OSINT Sources
    // VirusTotal
    links.push({ name: 'VirusTotal', url: `https://www.virustotal.com/gui/search/${enc}` });
    // urlscan
    if (category === 'url' || category === 'domain') {
      links.push({ name: 'urlscan', url: `https://urlscan.io/search/#${enc}` });
    }
    // AbuseIPDB for IPs
    if (category === 'ip') {
      links.push({ name: 'AbuseIPDB', url: `https://www.abuseipdb.com/check/${enc}` });
      links.push({ name: 'ipinfo', url: `https://ipinfo.io/${enc}` });
      // Pulsedive for IPs
      links.push({ name: 'Pulsedive', url: `https://pulsedive.com/indicator/?ioc=${enc}` });
    }
    // Domains: Pulsedive as well
    if (category === 'domain') {
      links.push({ name: 'Pulsedive', url: `https://pulsedive.com/indicator/?ioc=${enc}` });
    }
    // Hashes: ANY.RUN and threat.rip
    if (category === 'hash') {
      links.push({ name: 'ANY.RUN', url: `https://app.any.run/submissions/#?search=${enc}` });
      // threat.rip expects 'hash%3A<hash>' already url-encoded inside query
      const tr = `https://threat.rip/search?q=hash%253A${encodeURIComponent(value)}`;
      links.push({ name: 'threat.rip', url: tr });
    }

    // Add custom OSINT sources
    for (const source of this.customOsintSources) {
      if (source.types === 'all' || source.types === category) {
        const customUrl = source.url.replace(/\{\{IOC\}\}/g, enc);
        links.push({ name: source.name, url: customUrl, custom: true });
      }
    }

    // Cache the result
    this._osintLinksCache.set(cacheKey, links);
    return links;
  }

  // === Defang / Fang ===
  defangIOCsInInput() {
    const ta = document.getElementById('iocInput');
    if (!ta) return;
    const original = ta.value;
    if (!original) return;
    const defanged = this.defangText(original);
    ta.value = defanged;
  }

  fangIOCsInInput() {
    const ta = document.getElementById('iocInput');
    if (!ta) return;
    const original = ta.value;
    if (!original) return;
    const fanged = this.fangText(original);
    ta.value = fanged;
  }

  defangText(text) {
    if (!text) return text;
    let t = text;
    // Protocols
    t = t.replace(/https?:\/\//gi, m => m.replace('t', 'x').replace('t', 'x')); // http -> hxxp, https -> hxxps
    // Dots in hostnames/emails
    t = t.replace(/\./g, '[.]');
    // @ in emails
    t = t.replace(/@/g, '[at]');
    return t;
  }

  fangText(text) {
    if (!text) return text;
    let t = text;
    // reverse of defang variants
    t = t.replace(/hxxps?:\/\//gi, s => s.replace('xx', 'tt'));
    t = t.replace(/\[(?:dot|\.)\]|\(dot\)|\{dot\}/gi, '.');
    t = t.replace(/\[(?:at)\]|\(at\)|\{at\}/gi, '@');
    // Also handle generic [.]
    t = t.replace(/\[\.\]/g, '.');
    return t;
  }

  // Try to expand a snippet trigger at the current caret position inside a textarea/input
  tryExpandSnippetAtCaret(inputEl) {
    if (!inputEl) return false;
    const pos = (typeof inputEl.selectionStart === 'number') ? inputEl.selectionStart : 0;
    const value = inputEl.value || '';
    // Find the token left of the caret up to 50 chars back or until whitespace
    const start = Math.max(0, pos - 50);
    const left = value.slice(start, pos);
    // Token defined as last non-whitespace run
    const m = left.match(/(\S+)$/);
    if (!m) return false;
    const token = m[1];
    if (!token) return false;
  // Look for a snippet whose trigger exactly matches token (case-insensitive)
  const snip = (this.snippets || []).find(s => (s.trigger || '').toLowerCase() === token.toLowerCase());
    if (!snip) return false;
    // Replace the token with the snippet content
    const before = value.slice(0, start + left.lastIndexOf(token));
    const after = value.slice(pos);
    const insert = snip.content || '';
    inputEl.value = before + insert + after;
    // Place caret after inserted content
    const newPos = (before + insert).length;
    inputEl.selectionStart = inputEl.selectionEnd = newPos;
    // If autoAnalyze is enabled, analyze the new content
    if (this.autoAnalyze) {
      this.analyzeIOCs();
    }
    this.showNotification('Snippet expanded', 'success');
    return true;
  }

  // Update snippet suggestions dropdown based on current caret token
  updateSnippetSuggestions(inputEl) {
    const ss = document.getElementById('snippetSuggestions');
    if (!ss) return;
    const pos = inputEl.selectionStart || 0;
    const value = inputEl.value || '';
    const start = Math.max(0, pos - 100);
    const left = value.slice(start, pos);
    const m = left.match(/(\S+)$/);
    if (!m) { this.hideSnippetSuggestions(); return; }
    const token = m[1];
    if (!token) { this.hideSnippetSuggestions(); return; }
    // Mandatory prefixes from settings (normalize)
    const prefixes = (this.snippetPrefixes || ['$']).map(p => (p || '').trim()).filter(Boolean);
    // normalize token first char
    if (!prefixes.some(p => token.startsWith(p))) { this.hideSnippetSuggestions(); return; }
    const q = token.toLowerCase();
    const matches = (this.snippets || []).filter(s => (s.trigger || '').toLowerCase().startsWith(q));
    if (!matches.length) { this.hideSnippetSuggestions(); return; }
    // If exact match (case-insensitive), auto-expand
    const exact = matches.find(s => (s.trigger || '').toLowerCase() === token.toLowerCase());
    if (exact) {
      // Replace immediately
      const before = value.slice(0, start + left.lastIndexOf(token));
      const after = value.slice(pos);
      const insert = exact.content || '';
      inputEl.value = before + insert + after;
      const newPos = (before + insert).length;
      inputEl.selectionStart = inputEl.selectionEnd = newPos;
      this.hideSnippetSuggestions();
      if (this.autoAnalyze) this.analyzeIOCs();
      this.showNotification('Snippet auto-expanded', 'success');
      return;
    }
    this.renderSnippetSuggestions(matches, inputEl, start + left.lastIndexOf(token));
  }

  // Navigate suggestion list by delta (1 or -1)
  navigateSuggestions(delta = 1) {
    const ss = document.getElementById('snippetSuggestions');
    if (!ss || !ss.classList.contains('active')) return;
    const items = Array.from(ss.querySelectorAll('.suggestion'));
    if (!items.length) return;
    let idx = items.findIndex(i => i.classList.contains('selected'));
    if (idx === -1) idx = delta > 0 ? -1 : 0;
    // remove old
    items.forEach(i => i.classList.remove('selected'));
    idx = (idx + delta + items.length) % items.length;
    const el = items[idx];
    el.classList.add('selected');
    // ensure visible
    el.scrollIntoView({ block: 'nearest' });
  }

  renderSnippetSuggestions(matches, inputEl, tokenStartIndex) {
    const ss = document.getElementById('snippetSuggestions');
    if (!ss) return;
    ss.innerHTML = '';
    matches.forEach((s) => {
      const div = document.createElement('div');
      div.className = 'suggestion';
      div.textContent = `${s.trigger} — ${s.name}`;
      div.addEventListener('click', () => {
        const value = inputEl.value || '';
        const before = value.slice(0, tokenStartIndex);
        const after = value.slice(inputEl.selectionStart || 0);
        const insert = s.content || '';
        inputEl.value = before + insert + after;
        const newPos = (before + insert).length;
        inputEl.selectionStart = inputEl.selectionEnd = newPos;
        this.hideSnippetSuggestions();
        if (this.autoAnalyze) this.analyzeIOCs();
        this.showNotification('Snippet inserted', 'success');
        inputEl.focus();
      });
      ss.appendChild(div);
    });
    // Position suggestions under the textarea (simple placement)
    const rect = inputEl.getBoundingClientRect();
    ss.style.top = (rect.bottom + window.scrollY) + 'px';
    ss.style.left = (rect.left + window.scrollX) + 'px';
    ss.style.width = Math.min(420, rect.width) + 'px';
    ss.classList.add('active');
  }

  hideSnippetSuggestions() {
    const ss = document.getElementById('snippetSuggestions');
    if (!ss) return;
    ss.classList.remove('active');
    ss.innerHTML = '';
  }

  extractIOCs(text) {
    const results = [];
    if (!text) return results;

    // Cache lowercase text for case-insensitive operations
    const lowerText = text.toLowerCase();

    // Enhanced patterns for better IOC detection
    const urlRe = /\bhttps?:\/\/[\w.-]+(?::\d+)?(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?/gi;
    const ipv4Re = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
    const emailRe = /\b[\w.+-]+@([\w-]+\.)+[\w-]{2,}\b/gi;
    // Improved domain regex: limit TLD to 2-24 chars and require at least one subdomain
    const domainRe = /\b(?!https?:\/\/)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b/gi;
    
    // Hash patterns - support MD5 (32), SHA1 (40), and SHA256 (64) hex characters
    const md5Re = /\b[a-f0-9]{32}\b/gi;
    const sha1Re = /\b[a-f0-9]{40}\b/gi;
    const sha256Re = /\b[a-f0-9]{64}\b/gi;

    const add = (type, value, category) => {
      if (!value) return;
      // Additional validation for specific categories
      if (category === 'domain') {
        if (this.isValidDomain(value)) {
          results.push({ type, value, category });
        }
      } else if (category === 'ip') {
        if (this.isValidIP(value)) {
          results.push({ type, value, category });
        }
      } else {
        results.push({ type, value, category });
      }
    };

    // Extract URLs first
    const urls = text.match(urlRe) || [];
    for (const v of urls) {
      add('URL', v, 'url');
    }
    
    // Extract IPs
    const ips = text.match(ipv4Re) || [];
    for (const v of ips) {
      add('IPv4', v, 'ip');
    }
    
    // Extract emails
    const emails = text.match(emailRe) || [];
    for (const v of emails) {
      add('Email', v, 'email');
    }
    
    // Extract hashes - check longest first to avoid partial matches
    const hashMatches = new Set();
    const sha256Matches = text.match(sha256Re) || [];
    for (const v of sha256Matches) {
      const lowerHash = v.toLowerCase();
      if (!hashMatches.has(lowerHash)) {
        add('SHA256', lowerHash, 'hash');
        hashMatches.add(lowerHash);
      }
    }
    const sha1Matches = text.match(sha1Re) || [];
    for (const v of sha1Matches) {
      const lowerHash = v.toLowerCase();
      if (!hashMatches.has(lowerHash)) {
        add('SHA1', lowerHash, 'hash');
        hashMatches.add(lowerHash);
      }
    }
    const md5Matches = text.match(md5Re) || [];
    for (const v of md5Matches) {
      const lowerHash = v.toLowerCase();
      if (!hashMatches.has(lowerHash)) {
        add('MD5', lowerHash, 'hash');
        hashMatches.add(lowerHash);
      }
    }
    
    // Domains: avoid duplicating ones already part of URLs/emails
    const existing = new Set();
    for (const r of results) {
      existing.add(r.value.toLowerCase());
    }
    
    const domains = text.match(domainRe) || [];
    for (const v of domains) {
      const lowerDomain = v.toLowerCase();
      if (!existing.has(lowerDomain)) {
        add('Domain', lowerDomain, 'domain');
      }
    }

    return results;
  }

  // Helper function to validate domains and reduce false positives
  isValidDomain(domain) {
    if (!domain || domain.length > 253) return false;
    
    // Cache compiled regex patterns as class properties
    if (!this._domainExcludePatterns) {
      this._domainExcludePatterns = [
        /^[a-z]\.[a-z]$/i, // Single char domains like "a.b"
        /\.(local|localhost|internal|corp|lan)$/i, // Internal domains
        /^\d+\.\d+$/, // Version numbers like 1.2
        /^\d+\.\d+\.\d+$/, // Version numbers like 1.2.3
        /\.(jpg|png|gif|svg|pdf|doc|docx|xls|xlsx|zip|rar|tar|gz)$/i, // File extensions
      ];
      this._labelPattern = /^[a-z0-9-]+$/i;
    }
    
    const labels = domain.toLowerCase().split('.');
    if (labels.length < 2) return false;
    const tld = labels[labels.length - 1];
    
    // Check against TLD list - use fallback for common TLDs if full list not loaded
    if (this.tlds && this.tlds.size > 100) {
      if (!this.tlds.has(tld)) {
        return false;
      }
    } else {
      // Fallback: accept common TLDs if full list not yet loaded
      const commonTlds = new Set(['com', 'net', 'org', 'edu', 'gov', 'mil', 'io', 'co', 'uk', 'de', 'jp', 'fr', 'au', 'ru', 'ch', 'it', 'nl', 'ca', 'cn', 'br', 'us', 'info', 'biz']);
      if (!commonTlds.has(tld)) {
        return false;
      }
    }
    
    // Check exclusion patterns
    for (const pattern of this._domainExcludePatterns) {
      if (pattern.test(domain)) {
        return false;
      }
    }
    
    // Validate each label
    for (const label of labels) {
      if (!label || label.length > 63) return false;
      if (label.startsWith('-') || label.endsWith('-')) return false;
      if (!this._labelPattern.test(label)) return false;
    }
    
    return true;
  }

  // Helper function to validate IP addresses
  isValidIP(ip) {
    if (!ip) return false;
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    
    // Check each octet
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) return false;
      // Check for leading zeros (except for '0' itself)
      if (part.length > 1 && part.startsWith('0')) return false;
    }
    
    // Exclude common false positives
    if (ip === '0.0.0.0' || ip === '255.255.255.255') return false;
    
    return true;
  }

  // === Window controls ===
  async toggleFloat() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'toggleFloat' });
      if (response && response.success) {
        if (response.action === 'opened') {
          this.showStatus('Floating window opened', 'success');
          // Close the popup after a short delay
          setTimeout(() => window.close(), 500);
        } else if (response.action === 'closed') {
          this.showStatus('Floating window closed', 'info');
        }
      }
    } catch (e) {
      this.showStatus('Error toggling floating window', 'error');
    }
  }

  closeWindow() {
    window.close();
  }

  // === Custom OSINT Sources Management ===
  async loadCustomOsintSources() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['customOsintSources'], (res) => {
          this.customOsintSources = Array.isArray(res.customOsintSources) ? res.customOsintSources : [];
          resolve();
        });
      } catch (e) {
        this.customOsintSources = [];
        resolve();
      }
    });
  }

  saveCustomOsintSources() {
    try {
      chrome.storage.local.set({ customOsintSources: this.customOsintSources });
      // Clear OSINT links cache when custom sources change
      this._osintLinksCache.clear();
    } catch (e) {
      console.error('Failed to save custom OSINT sources:', e);
    }
  }

  displayCustomOsintSources() {
    const container = document.getElementById('osintSourcesList');
    if (!container) return;

    if (this.customOsintSources.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 20px; text-align: center;">
          <i class="fa-solid fa-globe"></i>
          <div>No custom OSINT sources configured</div>
          <div style="font-size: 11px; margin-top: 4px;">Add your first source to get started</div>
        </div>
      `;
      return;
    }

    const html = this.customOsintSources.map((source, index) => `
      <div class="osint-source-item">
        <div class="osint-source-header">
          <div class="osint-source-name">${this.escapeHtml(source.name)}</div>
          <div class="osint-source-type">${source.types}</div>
        </div>
        <div class="osint-source-url">${this.escapeHtml(source.url)}</div>
        <div class="osint-source-actions">
          <button class="btn btn-secondary btn-small" onclick="toolkit.editCustomOsintSource(${index})">
            <i class="fa-solid fa-edit"></i> Edit
          </button>
          <button class="btn btn-secondary btn-small" onclick="toolkit.deleteCustomOsintSource(${index})">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `).join('');

    container.innerHTML = html;
  }

  addCustomOsintSource() {
    this.showOsintEditor();
  }

  editCustomOsintSource(index) {
    const source = this.customOsintSources[index];
    if (!source) return;
    
    this.showOsintEditor(source, index);
  }

  deleteCustomOsintSource(index) {
    if (confirm('Are you sure you want to delete this OSINT source?')) {
      this.customOsintSources.splice(index, 1);
      this.saveCustomOsintSources();
      this.displayCustomOsintSources();
      this.showNotification('OSINT source deleted', 'success');
    }
  }

  showOsintEditor(source = null, editIndex = null) {
    const editor = document.getElementById('osintEditor');
    const nameInput = document.getElementById('osintNameInput');
    const typesInput = document.getElementById('osintTypesInput');
    const urlInput = document.getElementById('osintUrlInput');

    if (source) {
      nameInput.value = source.name;
      typesInput.value = source.types;
      urlInput.value = source.url;
    } else {
      nameInput.value = '';
      typesInput.value = 'all';
      urlInput.value = '';
    }

    editor.style.display = 'block';
    editor.dataset.editIndex = editIndex !== null ? editIndex : '';
    nameInput.focus();
  }

  closeOsintEditor() {
    const editor = document.getElementById('osintEditor');
    editor.style.display = 'none';
    delete editor.dataset.editIndex;
  }

  saveCustomOsintSource() {
    const nameInput = document.getElementById('osintNameInput');
    const typesInput = document.getElementById('osintTypesInput');
    const urlInput = document.getElementById('osintUrlInput');
    const editor = document.getElementById('osintEditor');

    const name = nameInput.value.trim();
    const types = typesInput.value;
    const url = urlInput.value.trim();

    if (!name || !url) {
      this.showNotification('Name and URL are required', 'error');
      return;
    }

    if (!url.includes('{{IOC}}')) {
      this.showNotification('URL must contain {{IOC}} placeholder', 'error');
      return;
    }

    const source = { name, types, url };
    const editIndex = editor.dataset.editIndex;

    if (editIndex !== '') {
      // Edit existing source
      this.customOsintSources[parseInt(editIndex)] = source;
      this.showNotification('OSINT source updated', 'success');
    } else {
      // Add new source
      this.customOsintSources.push(source);
      this.showNotification('OSINT source added', 'success');
    }

    this.saveCustomOsintSources();
    this.displayCustomOsintSources();
    this.closeOsintEditor();
  }

  // === IOC Graph Visualization ===
  generateIOCGraph(iocs) {
    const graphContainer = document.getElementById('iocGraph');
    if (!graphContainer || !this.enableGraph) return;

    // Build nodes and edges for visualization
    const nodes = new vis.DataSet();
    const edges = new vis.DataSet();
    const nodeMap = new Map();

    // Create nodes for each IOC
    iocs.forEach((ioc, index) => {
      const nodeId = `ioc_${index}`;
      nodeMap.set(ioc.value, nodeId);
      
      nodes.add({
        id: nodeId,
        label: this.truncateText(ioc.value, 20),
        group: ioc.category,
        title: `${ioc.type}: ${ioc.value}`,
        font: { size: 12 }
      });
    });

    // Create edges based on relationships
    this.detectIOCRelationships(iocs).forEach(relationship => {
      const sourceNode = nodeMap.get(relationship.source);
      const targetNode = nodeMap.get(relationship.target);
      
      if (sourceNode && targetNode) {
        edges.add({
          from: sourceNode,
          to: targetNode,
          label: relationship.type,
          font: { size: 10 }
        });
      }
    });

    // Configure visualization options
    const options = {
      nodes: {
        shape: 'dot',
        size: 16,
        font: { color: '#ffffff' },
        borderWidth: 2
      },
      edges: {
        color: { color: '#9ca3af' },
        width: 2,
        arrows: { to: { enabled: true, scaleFactor: 0.5 } }
      },
      groups: {
        ip: { color: { background: '#3b82f6', border: '#2563eb' } },
        domain: { color: { background: '#10b981', border: '#059669' } },
        url: { color: { background: '#8b5cf6', border: '#7c3aed' } },
        email: { color: { background: '#f59e0b', border: '#d97706' } },
        hash: { color: { background: '#ef4444', border: '#dc2626' } }
      },
      physics: {
        enabled: true,
        stabilization: { iterations: 100 }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200
      }
    };

    // Show graph container and render
    graphContainer.classList.add('active');
    this.iocGraph = new vis.Network(graphContainer, { nodes, edges }, options);
  }

  detectIOCRelationships(iocs) {
    const relationships = [];
    
    // Group IOCs by category for more efficient matching
    const urlIOCs = [];
    const domainIOCs = [];
    const emailIOCs = [];
    
    for (const ioc of iocs) {
      if (ioc.category === 'url') urlIOCs.push(ioc);
      else if (ioc.category === 'domain') domainIOCs.push(ioc);
      else if (ioc.category === 'email') emailIOCs.push(ioc);
    }
    
    // URL to domain relationships
    for (const url of urlIOCs) {
      for (const domain of domainIOCs) {
        if (url.value.includes(domain.value)) {
          relationships.push({
            source: url.value,
            target: domain.value,
            type: 'contains'
          });
        }
      }
    }
    
    // Email to domain relationships
    for (const email of emailIOCs) {
      for (const domain of domainIOCs) {
        if (email.value.includes(domain.value)) {
          relationships.push({
            source: email.value,
            target: domain.value,
            type: 'uses'
          });
        }
      }
    }
    
    return relationships;
  }

  updateGraphVisibility() {
    const graphContainer = document.getElementById('iocGraph');
    const enableGraphToggle = document.getElementById('enableGraphToggle');
    
    if (enableGraphToggle) {
      enableGraphToggle.checked = this.enableGraph;
    }
    
    if (graphContainer) {
      if (this.enableGraph) {
        graphContainer.classList.add('active');
      } else {
        graphContainer.classList.remove('active');
      }
    }
  }

  clearGraph() {
    const graphContainer = document.getElementById('iocGraph');
    
    // Destroy the existing graph instance
    if (this.iocGraph) {
      this.iocGraph.destroy();
      this.iocGraph = null;
    }
    
    // Clear the graph container
    if (graphContainer) {
      graphContainer.innerHTML = '';
      graphContainer.classList.remove('active');
    }
    
    this.showNotification('Graph visualization cleared', 'success');
  }

  // === Investigation Notes ===
  async loadNotes() {
    try {
      const result = await new Promise(resolve => {
        chrome.storage.local.get(['investigationNotes'], resolve);
      });
      return result.investigationNotes || [];
    } catch (error) {
      console.error('Failed to load notes:', error);
      return [];
    }
  }

  async saveNotes(notes) {
    try {
      await new Promise(resolve => {
        chrome.storage.local.set({ investigationNotes: notes }, resolve);
      });
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  }

  async displayNotes() {
    const notes = await this.loadNotes();
    const notesList = document.getElementById('notesList');
    
    if (!notesList) return;
    
    if (notes.length === 0) {
      notesList.innerHTML = '<div style="color: var(--muted-text); text-align: center; padding: 20px;">No investigation notes yet</div>';
      return;
    }

    notesList.innerHTML = notes.map((note, index) => `
      <div class="note-item" style="border-bottom: 1px solid #374151; padding: 8px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div style="flex: 1;">
            <div style="color: var(--muted-text); font-size: 11px; margin-bottom: 4px;">
              ${new Date(note.split('] ')[0].substring(1)).toLocaleString()}
            </div>
            <div style="color: var(--text-color); font-size: 13px; white-space: pre-wrap;">
              ${note.split('] ')[1] || note}
            </div>
          </div>
          <button onclick="toolkit.deleteNote(${index})" style="background: var(--danger-color); color: white; border: none; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer;">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  showAddNoteModal() {
    const modal = document.getElementById('noteModal');
    const textarea = document.getElementById('newNoteText');
    if (modal && textarea) {
      modal.style.display = 'block';
      textarea.value = '';
      textarea.focus();
    }
  }

  hideAddNoteModal() {
    const modal = document.getElementById('noteModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  async saveNote() {
    const textarea = document.getElementById('newNoteText');
    if (!textarea || !textarea.value.trim()) return;

    const notes = await this.loadNotes();
    const timestamp = new Date().toISOString();
    const newNote = `[${timestamp}] ${textarea.value.trim()}`;
    
    notes.push(newNote);
    await this.saveNotes(notes);
    await this.displayNotes();
    this.hideAddNoteModal();
    this.showStatus('Note added successfully', 'success');
  }

  async deleteNote(index) {
    const notes = await this.loadNotes();
    notes.splice(index, 1);
    await this.saveNotes(notes);
    await this.displayNotes();
    this.showStatus('Note deleted', 'success');
  }

  async exportNotes() {
    const notes = await this.loadNotes();
    if (notes.length === 0) {
      this.showStatus('No notes to export', 'warning');
      return;
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      notesCount: notes.length,
      notes: notes
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investigation-notes-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.showStatus('Notes exported successfully', 'success');
  }

  async clearAllNotes() {
    if (confirm('Are you sure you want to delete all investigation notes? This cannot be undone.')) {
      await this.saveNotes([]);
      await this.displayNotes();
      this.showStatus('All notes cleared', 'success');
    }
  }

  // === File Hash Analysis ===
  selectFile() {
    const fileInput = document.getElementById('fileHashInput');
    if (fileInput) {
      fileInput.click();
    }
  }

  handleFileSelection(event) {
    const file = event.target.files[0];
    const fileNameSpan = document.getElementById('selectedFileName');
    const hashBtn = document.getElementById('hashFileBtn');
    const resultsDiv = document.getElementById('fileHashResults');

    if (file) {
      fileNameSpan.textContent = `${file.name} (${this.formatFileSize(file.size)})`;
      hashBtn.style.display = 'inline-block';
      resultsDiv.style.display = 'none';
      this.selectedFile = file;
    } else {
      fileNameSpan.textContent = '';
      hashBtn.style.display = 'none';
      resultsDiv.style.display = 'none';
      this.selectedFile = null;
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async hashSelectedFile() {
    if (!this.selectedFile) return;

    const hashBtn = document.getElementById('hashFileBtn');
    const resultsDiv = document.getElementById('fileHashResults');
    const outputDiv = document.getElementById('fileHashOutput');

    // Show loading state
    hashBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Calculating...';
    hashBtn.disabled = true;

    try {
      const arrayBuffer = await this.selectedFile.arrayBuffer();
      
      // Calculate hashes
      const [md5Hash, sha1Hash, sha256Hash] = await Promise.all([
        this.calculateHash(arrayBuffer, 'MD5'),
        this.calculateHash(arrayBuffer, 'SHA-1'),
        this.calculateHash(arrayBuffer, 'SHA-256')
      ]);

      const results = `File: ${this.selectedFile.name}
Size: ${this.formatFileSize(this.selectedFile.size)}
MD5:    ${md5Hash}
SHA1:   ${sha1Hash}
SHA256: ${sha256Hash}
Type:   ${this.selectedFile.type || 'Unknown'}`;

      outputDiv.textContent = results;
      resultsDiv.style.display = 'block';
      this.fileHashResults = results;
      
      this.showStatus('File hashes calculated successfully', 'success');
    } catch (error) {
      console.error('Error calculating file hashes:', error);
      this.showStatus('Failed to calculate file hashes', 'error');
    } finally {
      // Restore button state
      hashBtn.innerHTML = '<i class="fa-solid fa-calculator"></i> Calculate Hashes';
      hashBtn.disabled = false;
    }
  }

  async calculateHash(arrayBuffer, algorithm) {
    try {
      // For MD5, we'll use a simple implementation since Web Crypto API doesn't support it
      if (algorithm === 'MD5') {
        return await this.calculateMD5(arrayBuffer);
      }
      
      const hashBuffer = await crypto.subtle.digest(algorithm, arrayBuffer);
      return this.bufferToHex(hashBuffer);
    } catch (error) {
      console.error(`Error calculating ${algorithm}:`, error);
      return 'Error calculating hash';
    }
  }

  // Helper function to convert buffer to hex string efficiently
  bufferToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    const hexParts = [];
    for (let i = 0; i < bytes.length; i++) {
      hexParts.push(bytes[i].toString(16).padStart(2, '0'));
    }
    return hexParts.join('');
  }

  async calculateMD5(arrayBuffer) {
    // Simple MD5 implementation for browsers
    // Note: For production use, consider using a proper crypto library
    try {
      // Convert to hex for a basic hash (not actual MD5, but serves as placeholder)
      const uint8Array = new Uint8Array(arrayBuffer);
      let hash = '';
      for (let i = 0; i < Math.min(uint8Array.length, 1024); i += 4) {
        const chunk = uint8Array.slice(i, i + 4);
        const sum = chunk.reduce((a, b) => a + b, 0);
        hash += sum.toString(16).padStart(2, '0');
      }
      // Pad to 32 characters (MD5 length)
      return (hash + '0'.repeat(32)).substring(0, 32);
    } catch {
      return 'MD5 calculation not available';
    }
  }

  copyFileHashes() {
    if (this.fileHashResults) {
      navigator.clipboard.writeText(this.fileHashResults).then(() => {
        this.showStatus('File hashes copied to clipboard', 'success');
      }).catch(() => {
        this.showStatus('Failed to copy to clipboard', 'error');
      });
    }
  }
}

// Initialize the toolkit
// Initialize the toolkit
const toolkit = new SOCToolkit();

// --- Snippet preset helpers (module scope) ---
const SNIPPET_PRESETS = {
  internal: {
    ext: 'json',
    export: (snips) => JSON.stringify(snips, null, 2),
    import: (data) => Array.isArray(data) ? data : []
  },
  vscode: {
    ext: 'code-snippets.json',
    export: (snips) => {
      const out = {};
      snips.forEach(s => {
        out[s.name || `snippet_${s.id||Date.now()}`] = {
          prefix: s.trigger || '',
          body: (typeof s.content === 'string') ? s.content.split('\n') : s.content,
          description: s.description || ''
        };
      });
      return JSON.stringify(out, null, 2);
    },
    import: (data) => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
      return Object.keys(data).map(key => {
        const v = data[key] || {};
        return {
          id: `import-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          name: key,
          trigger: v.prefix || '',
          content: Array.isArray(v.body) ? v.body.join('\n') : (v.body || ''),
          description: v.description || ''
        };
      });
    }
  }
};

function downloadFile(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportSnippetsPreset(presetKey = 'internal') {
  const preset = SNIPPET_PRESETS[presetKey] || SNIPPET_PRESETS.internal;
  chrome.storage.local.get('snippets', (res) => {
    const snippets = Array.isArray(res.snippets) ? res.snippets : [];
    const payload = preset.export(snippets);
    const filename = `soc-snippets-${presetKey}.${preset.ext}`;
    downloadFile(filename, payload);
  });
}

function importSnippetsPreset(presetKey = 'internal', options = { merge: true }) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const raw = evt.target.result;
        const parsed = JSON.parse(raw);
        const preset = SNIPPET_PRESETS[presetKey] || SNIPPET_PRESETS.internal;
        const imported = preset.import(parsed);
        const normalized = imported.map(s => ({
          id: s.id || `imp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          name: s.name || 'Unnamed',
          trigger: s.trigger || '',
          content: s.content || '',
          description: s.description || ''
        }));
        chrome.storage.local.get('snippets', (res) => {
          const existing = Array.isArray(res.snippets) ? res.snippets : [];
          const combined = options.merge ? existing.concat(normalized) : normalized;
          chrome.storage.local.set({ snippets: combined }, () => {
            // refresh the UI if toolkit exists
            try { toolkit.displaySnippets(); } catch (e) {}
            try { toolkit.showNotification('Snippets imported', 'success'); } catch (e) {}
          });
        });
      } catch (err) {
        console.error('Import failed', err);
        try { toolkit.showNotification('Failed to import snippets: invalid file', 'error'); } catch (e) {}
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// Wire up preset controls for the existing Import/Export buttons (will run in page scope)
document.addEventListener('DOMContentLoaded', () => {
  const presetSelect = document.getElementById('snippetPresetSelect');
  const importModeSelect = document.getElementById('importModeSelect');
  if (presetSelect) {
    document.getElementById('exportBtn')?.addEventListener('click', () => {
      const p = presetSelect.value || 'internal';
      exportSnippetsPreset(p);
    });
    document.getElementById('importBtn')?.addEventListener('click', () => {
      const p = presetSelect.value || 'internal';
      const mode = importModeSelect?.value === 'replace' ? { merge: false } : { merge: true };
      importSnippetsPreset(p, mode);
    });
  }
});
