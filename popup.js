// SOC Analyst Toolkit - Popup JavaScript

class SOCToolkit {
  constructor() {
    this.currentTab = 'ioc';
    this.snippets = [];
    this.autoAnalyze = true;
  this.snippetPrefixes = ['$', ':']; // default (note: trimmed later)
    this.floatMode = false;
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    await this.loadSnippets();
    this.displaySnippets();
    await this.checkPendingAnalysis();
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
    let autoAnalyzeTimeout;

      if (autoAnalyzeToggle) {
        autoAnalyzeToggle.checked = this.autoAnalyze;
        autoAnalyzeToggle.addEventListener('change', (e) => {
          this.autoAnalyze = e.target.checked;
          this.saveSettings();
        });
      }

      // Load prefixes input and wire change (element is in Snippets tab)
      const prefInput = document.getElementById('prefixesInput');
      if (prefInput) {
        prefInput.value = (this.snippetPrefixes || ['$']).join(',');
        prefInput.addEventListener('change', (e) => {
          const raw = (e.target.value || '').split(',').map(s => s.trim()).filter(Boolean);
          this.snippetPrefixes = raw.length ? raw : ['$'];
          this.saveSettings();
        });
      }

      // Snippet editor buttons (save/cancel)
      const saveBtn = document.getElementById('snippetSaveBtn');
      const cancelBtn = document.getElementById('snippetCancelBtn');
      if (saveBtn) saveBtn.addEventListener('click', () => this.saveSnippetFromEditor());
      if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeSnippetEditor());

      if (iocInput) {
        iocInput.addEventListener('input', () => {
          // Always update snippet suggestions regardless of autoAnalyze setting
          try { this.updateSnippetSuggestions(iocInput); } catch (err) {}
          // Auto-analysis (debounced)
          clearTimeout(autoAnalyzeTimeout);
          if (this.autoAnalyze) {
            autoAnalyzeTimeout = setTimeout(() => {
              if (iocInput.value.trim()) {
                this.analyzeIOCs();
              } else {
                this.clearIOCs();
              }
            }, 500);
          }
        });
        // Snippet trigger expansion in the IOC input: Tab or Enter/Space will try to expand a matching trigger
        iocInput.addEventListener('keydown', (e) => {
          try {
            if (e.key === 'Tab') {
              // Prevent focus change
              e.preventDefault();
              const expanded = this.tryExpandSnippetAtCaret(iocInput);
              if (!expanded) {
                // If no expansion, but suggestions visible, pick first suggestion
                const ss = document.getElementById('snippetSuggestions');
                if (ss && ss.querySelector('.suggestion')) {
                  ss.querySelector('.suggestion').click();
                }
              }
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              // Navigate suggestions
              const ss = document.getElementById('snippetSuggestions');
              if (ss && ss.classList.contains('active')) {
                e.preventDefault();
                this.navigateSuggestions(e.key === 'ArrowDown' ? 1 : -1);
              }
            } else if (e.key === 'Escape') {
              this.hideSnippetSuggestions();
            } else if (e.key === 'Enter' || e.key === ' ') {
              const ss = document.getElementById('snippetSuggestions');
              if (ss && ss.classList.contains('active')) {
                // If a suggestion is selected, activate it
                const sel = ss.querySelector('.suggestion.selected') || ss.querySelector('.suggestion');
                if (sel) {
                  e.preventDefault();
                  sel.click();
                  return;
                }
              }
              // Let the key event finish (Enter/Space may insert), then check for expansion
              setTimeout(() => this.tryExpandSnippetAtCaret(iocInput), 0);
            }
          } catch (err) {
            // ignore
          }
        });
      }

    // Snippet functionality
  el('snippetSearch')?.addEventListener('input', (e) => this.searchSnippets(e.target.value));
  el('addSnippetBtn')?.addEventListener('click', () => this.addSnippet());
  el('importBtn')?.addEventListener('click', () => this.importSnippets());
  el('exportBtn')?.addEventListener('click', () => this.exportSnippets());

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
    const targetId = tabName === 'snippets' ? 'snippets-tab' : 'ioc-tab';
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
    }
  }

  // IOC Analysis Functions
  analyzeIOCs() {
    const input = document.getElementById('iocInput').value.trim();
    if (!input) {
      this.showNotification('Please enter text to analyze', 'error');
      return;
    }
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

    const html = iocs.map(ioc => {
      const osintLinks = this.generateOSINTLinks(ioc.value, ioc.category);
      return `
        <div class="ioc-item">
          <input type="checkbox" class="ioc-select" />
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <div class="ioc-value" data-copy="${this.escapeHtml(ioc.value)}" title="Click to copy">
                ${this.truncateText(ioc.value, 40)}
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
        </div>`;
    }).join('');
    listEl.innerHTML = html;

    // Update count
    const countEl = resultsContainer.querySelector('.ioc-count');
    if (countEl) countEl.textContent = `IOC Results [${iocs.length}]`;

    // Add event listeners for copy functionality
    this.setupCopyEventListeners();
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
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ioc-results-${new Date().toISOString().split('T')[0]}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);

    this.showNotification(`Exported ${iocs.length} IOCs as ${format.toUpperCase()}`, 'success');
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
        chrome.storage.local.get(['socSettings'], (res) => {
          const defaults = { autoAnalyze: true };
          const s = res.socSettings || defaults;
          this.autoAnalyze = s.autoAnalyze ?? true;
          // load snippetPrefixes if present
          if (s.snippetPrefixes && Array.isArray(s.snippetPrefixes)) this.snippetPrefixes = s.snippetPrefixes;
          resolve();
        });
      } catch (e) {
        this.autoAnalyze = true;
        resolve();
      }
    });
  }

  saveSettings() {
    try {
      const socSettings = { autoAnalyze: this.autoAnalyze, snippetPrefixes: this.snippetPrefixes };
      chrome.storage.local.set({ socSettings });
    } catch {}
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

    list.innerHTML = data.map((snip, idx) => `
      <div class="snippet-item" data-index="${idx}">
        <div class="snippet-header">
          <div class="snippet-name">${this.escapeHtml(snip.name || 'Untitled')}</div>
          <div class="snippet-trigger">${this.escapeHtml(snip.trigger || '')}</div>
        </div>
        <div class="snippet-content">
          <div class="snippet-text">${this.escapeHtml(snip.content || '')}</div>
          <div class="snippet-actions">
            <button class="btn btn-primary btn-small action-use"><i class="fa-solid fa-play"></i> Use</button>
            <button class="btn btn-secondary btn-small action-copy"><i class="fa-regular fa-copy"></i> Copy</button>
            <button class="btn btn-secondary btn-small action-edit"><i class="fa-regular fa-pen-to-square"></i> Edit</button>
            <button class="btn btn-secondary btn-small action-delete"><i class="fa-regular fa-trash-can"></i> Delete</button>
          </div>
        </div>
      </div>
    `).join('');

    // Wire up interactions
    list.querySelectorAll('.snippet-header').forEach((h) => {
      h.addEventListener('click', () => {
        h.parentElement.querySelector('.snippet-content').classList.toggle('expanded');
      });
    });

    list.querySelectorAll('.action-copy').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const item = e.target.closest('.snippet-item');
        const idx = Number(item.dataset.index);
        const snip = data[idx];
        this.copyToClipboard(snip.content || '');
      });
    });

    list.querySelectorAll('.action-use').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const item = e.target.closest('.snippet-item');
        const idx = Number(item.dataset.index);
        const snip = data[idx];
        this.copyToClipboard(snip.content || '');
        this.showNotification('Snippet copied to clipboard', 'success');
      });
    });

    list.querySelectorAll('.action-edit').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const item = e.target.closest('.snippet-item');
        const idx = Number(item.dataset.index);
        this.openSnippetEditor(idx);
      });
    });

    list.querySelectorAll('.action-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const item = e.target.closest('.snippet-item');
        const idx = Number(item.dataset.index);
        const snip = data[idx];
        if (confirm(`Delete snippet "${snip.name || 'Untitled'}"?`)) {
          const realIndex = this.snippets.indexOf(snip);
          if (realIndex >= 0) {
            this.snippets.splice(realIndex, 1);
            this.saveSnippets();
            this.displaySnippets();
          }
        }
      });
    });
  }

  searchSnippets(query) {
    const q = (query || '').toLowerCase();
    if (!q) return this.displaySnippets();
    const filtered = this.snippets.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.trigger || '').toLowerCase().includes(q) ||
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
    const triggerIn = document.getElementById('snippetTriggerInput');
    const contentIn = document.getElementById('snippetContentInput');
    if (!editor || !nameIn || !triggerIn || !contentIn) return;
    // If index provided, load existing
    if (index !== null && this.snippets[index]) {
      const s = this.snippets[index];
      nameIn.value = s.name || '';
      triggerIn.value = s.trigger || '';
      contentIn.value = s.content || '';
      editor.dataset.editIndex = String(index);
    } else {
      nameIn.value = '';
      triggerIn.value = '';
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
    const triggerIn = document.getElementById('snippetTriggerInput');
    const contentIn = document.getElementById('snippetContentInput');
    if (!nameIn || !triggerIn || !contentIn) return;
    const name = (nameIn.value || '').trim();
    const trigger = (triggerIn.value || '').trim();
    const content = contentIn.value || '';
    if (!name) { this.showNotification('Please provide a name', 'error'); return; }
    const idx = editor.dataset.editIndex !== undefined ? Number(editor.dataset.editIndex) : -1;
    if (idx >= 0 && this.snippets[idx]) {
      this.snippets[idx] = { name, trigger, content };
    } else {
      this.snippets.push({ name, trigger, content });
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
        const cleaned = arr.map(s => ({ name: s.name || 'Untitled', trigger: s.trigger || '', content: s.content || '' }));
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
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  generateOSINTLinks(value, category) {
    const enc = encodeURIComponent(value);
    const links = [];
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

    // Basic patterns
    const urlRe = /\bhttps?:\/\/[\w.-]+(?::\d+)?(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?/gi;
    const ipv4Re = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
    const emailRe = /\b[\w.+-]+@([\w-]+\.)+[\w-]{2,}\b/gi;
    const domainRe = /\b(?!https?:\/\/)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
    const sha256Re = /\b[a-f0-9]{64}\b/gi;

    const add = (type, value, category) => {
      if (!value) return;
      results.push({ type, value, category });
    };

    (text.match(urlRe) || []).forEach(v => add('URL', v, 'url'));
    (text.match(ipv4Re) || []).forEach(v => add('IPv4', v, 'ip'));
    (text.match(emailRe) || []).forEach(v => add('Email', v, 'email'));
    (text.match(sha256Re) || []).forEach(v => add('SHA256', v, 'hash'));
    // Domains: avoid duplicating ones already part of URLs/emails
    const existing = new Set(results.map(r => r.value.toLowerCase()));
    (text.match(domainRe) || []).forEach(v => {
      if (!existing.has(v.toLowerCase())) add('Domain', v, 'domain');
    });

    return results;
  }

  // === Window controls ===
  async toggleFloat() {
    try {
      await chrome.runtime.sendMessage({ action: 'toggleFloat' });
    } catch (e) {
      // ignore
    }
  }

  closeWindow() {
    window.close();
  }
}

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
