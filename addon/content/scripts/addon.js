"use strict";

var ItemPaneOrganizer = {
  _initialized: false,
  _addonID: "",
  _paneManager: null,
  _paneKey: null,
  _sectionRefresh: null,
  _mainWindows: new Set(),
  _discoveryTimers: new Map(),
  _currentRoot: null,
  _applyingOrder: false,
  _moveInProgress: false,
  _orderPref: "extensions.itempaneorganizer.order",
  _dragState: null,
  _log(message) {
    try { Zotero.debug("[ItemPaneOrganizer] " + message); } catch (e) {}
  },

  async init() {
    if (this._initialized) return;
    this._initialized = true;
    this._addonID = typeof addonID !== "undefined" ? addonID : "itempaneorganizer@example.com";
    this._paneManager = Zotero.ItemPaneManager;
    this._registerItemPaneSection();
    this._discoverMainWindows();
    this._log("initialized; target=Zotero 10 Item Pane DOM");
  },

  shutdown() {
    for (const timer of this._discoveryTimers.values()) {
      try { clearTimeout(timer); } catch (e) {}
    }
    this._discoveryTimers.clear();
    this._mainWindows.clear();
    this._currentRoot = null;
    try {
      if (this._paneKey && this._paneManager && this._paneManager.unregisterSection) {
        this._paneManager.unregisterSection(this._paneKey);
      }
    } catch (e) {}
    this._paneKey = null;
    this._sectionRefresh = null;
    this._initialized = false;
  },

  _registerItemPaneSection() {
    try {
      if (!this._paneManager || typeof this._paneManager.registerSection !== "function") return;
      this._paneKey = this._paneManager.registerSection({
        paneID: "itempaneorganizer",
        pluginID: this._addonID,
        header: {
          l10nID: "itempaneorganizer-itemPaneSection-header",
          icon: "chrome://itempaneorganizer/content/icons/section.svg",
        },
        sidenav: {
          l10nID: "itempaneorganizer-itemPaneSection-sidenav",
          icon: "chrome://itempaneorganizer/content/icons/section.svg",
          orderable: true,
        },
        bodyXHTML: '<html:div class="itempaneorganizer-body"></html:div>',
        onInit: ({ refresh }) => { this._sectionRefresh = refresh; },
        onDestroy: () => { this._sectionRefresh = null; },
        onRender: ({ doc, body }) => this._renderBody(doc, body),
      });
      this._log("registered organizer pane: " + this._paneKey);
    } catch (e) {
      this._log("register section failed: " + (e && (e.stack || e.message) || e));
    }
  },

  _discoverMainWindows() {
    try {
      const windows = Services.wm.getEnumerator("navigator:browser");
      while (windows.hasMoreElements()) this._watchWindow(windows.getNext());
    } catch (e) {
      this._log("discover windows failed: " + (e && e.message || e));
    }
  },

  _watchWindow(win) {
    if (!win || this._mainWindows.has(win)) return;
    this._mainWindows.add(win);
    this._tryFindSidenav(win, 0);
  },

  _tryFindSidenav(win, attempt) {
    if (!this._initialized || !win || win.closed) return;
    const root = win.document && win.document.querySelector("item-pane-sidenav");
    if (root) {
      this._currentRoot = root;
      this._applySavedOrder(root);
      this._log("sidenav found; entries=" + this._readEntries(root).length);
      return;
    }
    if (attempt >= 20) {
      this._log("sidenav not found after discovery attempts");
      return;
    }
    const timer = setTimeout(() => {
      this._discoveryTimers.delete(win);
      this._tryFindSidenav(win, attempt + 1);
    }, 250);
    this._discoveryTimers.set(win, timer);
  },

  _getMainWindow() {
    try {
      return Zotero.getMainWindow ? Zotero.getMainWindow() : null;
    } catch (e) { return null; }
  },

  _getLiveRoot() {
    const win = this._getMainWindow();
    const roots = win && win.document ? Array.from(win.document.querySelectorAll("item-pane-sidenav")) : [];
    const scored = roots.map(root => {
      const container = this._getContainer(root);
      const buttons = container ? Array.from(container.querySelectorAll(".pin-wrapper .btn[data-pane]")) : [];
      const visible = !!(root.offsetWidth || root.offsetHeight || root.getClientRects().length);
      const custom = buttons.filter(button => !this._builtinIDs().has(String(button.dataset.pane || ""))).length;
      return { root, score: (visible ? 1000 : 0) + custom * 100 + buttons.length };
    }).sort((a, b) => b.score - a.score);
    const root = scored[0]?.root || null;
    if (root) this._currentRoot = root;
    return root || this._currentRoot;
  },

  _getContainer(root) {
    return root && root.querySelector(".inherit-flex");
  },

  _builtinIDs() {
    return new Set(["info", "abstract", "attachments", "notes", "note-info", "attachment-info", "attachment-annotations", "libraries-collections", "tags", "related"]);
  },

  _readEntries(root) {
    const container = this._getContainer(root);
    const domEntries = container ? Array.from(container.querySelectorAll(".pin-wrapper .btn[data-pane]")) : [];
    const byID = new Map();
    domEntries.forEach((button, index) => {
      const id = String(button.dataset.pane || "");
      if (!id || byID.has(id)) return;
      const isBuiltin = this._builtinIDs().has(id);
      const custom = !isBuiltin && id !== "itempaneorganizer";
      byID.set(id, {
        id,
        index,
        button,
        wrapper: button.parentElement,
        visible: !button.parentElement.hidden,
        rendered: true,
        custom,
        pluginID: custom ? this._pluginIDFromPaneID(id) : "Zotero",
        label: this._resolvePaneLabel(button, id),
      });
    });
    for (const section of this._readRegisteredSections()) {
      if (!section.paneID || section.paneID === "itempaneorganizer" || byID.has(section.paneID)) continue;
      const custom = !this._builtinIDs().has(section.paneID);
      byID.set(section.paneID, {
        id: section.paneID,
        index: byID.size,
        button: null,
        wrapper: null,
        visible: false,
        rendered: false,
        custom,
        pluginID: section.pluginID || this._pluginIDFromPaneID(section.paneID),
        label: section.label || section.paneID,
      });
    }
    return Array.from(byID.values());
  },

  _pluginIDFromPaneID(id) {
    const known = ["wordtranslator@example.com", "zoteropdftranslate@euclpts.com", "zotero-ai-butler@github.com", "zotero-llm@github.com.yilewang"];
    const hit = known.find(pluginID => id === pluginID || id.startsWith(pluginID + "-"));
    if (hit) return hit;
    const at = id.indexOf("@");
    return at >= 0 ? id.slice(0, id.indexOf("-", at) >= 0 ? id.indexOf("-", at) : id.length) : "";
  },

  _resolvePaneLabel(button, id) {
    const nativeLabels = {
      info: "信息",
      abstract: "摘要",
      attachments: "附件",
      notes: "笔记",
      "note-info": "笔记信息",
      "attachment-info": "附件信息",
      "attachment-annotations": "附件批注",
      "libraries-collections": "文库与分类",
      tags: "标签",
      related: "关联条目",
    };
    if (nativeLabels[id]) return nativeLabels[id];
    const knownPluginLabels = {
      "wordtranslator@example.com-wordtranslator": "单词翻译",
      "zoteropdftranslate@euclpts.com-translate": "PDF 翻译",
    };
    if (knownPluginLabels[id]) return knownPluginLabels[id];
    if (!button) return id;
    const text = button.getAttribute("aria-label") || button.getAttribute("tooltiptext") || button.getAttribute("title");
    return text || id;
  },

  _readRegisteredSections() {
    const manager = this._paneManager;
    if (!manager || !manager.customSectionData) return [];
    const out = [];
    const seen = new Set();
    for (const opt of manager.customSectionData.options || []) {
      const paneID = opt.paneID;
      if (!paneID || paneID === "itempaneorganizer") continue;
      const id = (opt.pluginID ? CSS.escape(opt.pluginID + "-" + paneID) : paneID);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        paneID: id,
        pluginID: opt.pluginID,
        label: opt.header?.l10nID || opt.sidenav?.l10nID || paneID,
      });
    }
    return out;
  },

  _renderBody(doc, body) {
    if (!doc || !body) return;
    body.replaceChildren();
    const style = doc.createElementNS("http://www.w3.org/1999/xhtml", "style");
    style.textContent = ".ipo{font:message-box;padding:10px;min-width:0;max-width:100%}.ipo h2{margin:0 0 4px;font-size:15px}.ipo p{color:GrayText;margin:0 0 8px;line-height:1.35}.ipo-list{min-width:0;max-height:calc(100vh - 150px);overflow:auto}.ipo-row{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(72px,22%);align-items:center;gap:7px;padding:6px 0;border-bottom:1px solid color-mix(in srgb,currentColor 15%,transparent);min-width:0;cursor:grab}.ipo-row.ipo-dragging{opacity:.45}.ipo-row.ipo-over{border-top:2px solid #6aa9d8}.ipo-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ipo-id{color:GrayText;font-size:11px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ipo-kind{color:#6aa9d8;font-size:11px;white-space:nowrap}.ipo-hint{color:GrayText;font-size:11px;margin-top:8px}.ipo-empty{color:GrayText}.ipo-unrendered{opacity:.55;cursor:not-allowed}.ipo-btn{background:buttonface;border:1px solid buttonborder;border-radius:3px;padding:3px 10px;font:message-box;cursor:pointer;margin:0 0 8px}";
    body.append(style);
    const panel = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    panel.className = "ipo";
    const title = doc.createElementNS("http://www.w3.org/1999/xhtml", "h2");
    title.textContent = "内容窗格调整";
    panel.append(title);
    const help = doc.createElementNS("http://www.w3.org/1999/xhtml", "p");
    help.textContent = "调整当前 Zotero 内容窗格中的原生面板和插件面板。插件未提供排序设置时，也可在这里移动。";
    panel.append(help);
    const resetBtn = doc.createElementNS("http://www.w3.org/1999/xhtml", "button");
    resetBtn.className = "ipo-btn";
    resetBtn.textContent = "恢复默认顺序";
    resetBtn.addEventListener("click", () => {
      Zotero.Prefs.set("sidenav.order", "");
      Zotero.Prefs.set(this._orderPref, "", true);
      list.replaceChildren();
      this._renderList(doc, list);
    });
    panel.append(resetBtn);
    const list = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    list.className = "ipo-list";
    panel.append(list);
    const hint = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    hint.className = "ipo-hint";
    const ver = typeof addonVersion !== "undefined" ? "版本 " + addonVersion : "";
    hint.textContent = "拖动行项目可调整顺序；灰色项目表示插件尚未在当前内容窗格渲染。" + (ver ? "  " + ver : "");
    panel.append(hint);
    body.append(panel);
    this._renderList(doc, list);
  },

  _renderList(doc, list) {
    const root = this._getLiveRoot();
    const entries = this._readEntries(root);
    if (!entries.length) {
      const empty = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
      empty.className = "ipo-empty";
      empty.textContent = "当前没有读取到内容窗格项目。请打开一个条目后重试。";
      list.append(empty);
      return;
    }
    entries.forEach((entry) => {
      const row = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
      row.className = "ipo-row" + (entry.rendered ? "" : " ipo-unrendered");
      row.dataset.paneID = entry.id;
      row.draggable = !!entry.wrapper;
      row.title = entry.wrapper ? "拖动此行调整顺序" : "该面板尚未在当前内容窗格中渲染";
      row.addEventListener("dragstart", event => this._onDragStart(event, row, list));
      row.addEventListener("dragover", event => this._onDragOver(event, row, list));
      row.addEventListener("dragleave", () => row.classList.remove("ipo-over"));
      row.addEventListener("drop", event => this._onDrop(event, row, list));
      row.addEventListener("dragend", () => this._clearDragState(list));

      const name = doc.createElementNS("http://www.w3.org/1999/xhtml", "span");
      name.className = "ipo-name";
      name.textContent = entry.label;
      name.title = entry.label;
      const kind = doc.createElementNS("http://www.w3.org/1999/xhtml", "span");
      kind.className = "ipo-kind";
      kind.textContent = entry.custom ? "插件" : "原生";
      const id = doc.createElementNS("http://www.w3.org/1999/xhtml", "span");
      id.className = "ipo-id";
      id.textContent = entry.custom ? (entry.pluginID || "第三方插件") : entry.id;
      id.title = entry.id;
      row.append(name, kind, id);
      list.append(row);
    });
  },

  _onDragStart(event, row, list) {
    if (!row.draggable || this._moveInProgress) {
      event.preventDefault();
      return;
    }
    this._dragState = { paneID: row.dataset.paneID, row, list };
    row.classList.add("ipo-dragging");
    try {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", row.dataset.paneID);
    } catch (e) {}
  },

  _onDragOver(event, row) {
    if (!this._dragState || row === this._dragState.row || !row.draggable) return;
    event.preventDefault();
    row.classList.add("ipo-over");
    try { event.dataTransfer.dropEffect = "move"; } catch (e) {}
  },

  _onDrop(event, targetRow, list) {
    event.preventDefault();
    const state = this._dragState;
    if (!state || targetRow === state.row || !targetRow.draggable) return;
    const root = this._getLiveRoot();
    const container = this._getContainer(root);
    const entries = this._readEntries(root);
    const source = entries.find(entry => entry.id === state.paneID && entry.wrapper);
    const target = entries.find(entry => entry.id === targetRow.dataset.paneID && entry.wrapper);
    if (!container || !source || !target) return;
    this._moveInProgress = true;
    try {
      const targetRect = targetRow.getBoundingClientRect();
      const insertBefore = event.clientY < targetRect.top + targetRect.height / 2;
      if (insertBefore) container.insertBefore(source.wrapper, target.wrapper);
      else container.insertBefore(source.wrapper, target.wrapper.nextSibling);
      const order = this._readEntries(root).filter(entry => entry.wrapper).map(entry => entry.id);
      // 双写：官方 pref 让 Zotero 持久化并遵守（orderable 面板）；插件 pref 兜底（含非 orderable 面板）
      Zotero.Prefs.set("sidenav.order", order.join(","));
      Zotero.Prefs.set(this._orderPref, order.join(","), true);
      list.replaceChildren();
      this._renderList(list.ownerDocument, list);
      this._log("dragged " + state.paneID + "; order=" + order.join(","));
    } catch (e) {
      this._log("drag failed: " + (e && (e.stack || e.message) || e));
    } finally {
      this._moveInProgress = false;
      this._clearDragState(list);
    }
  },

  _clearDragState(list) {
    if (this._dragState?.row) this._dragState.row.classList.remove("ipo-dragging");
    if (list) list.querySelectorAll(".ipo-over").forEach(row => row.classList.remove("ipo-over"));
    this._dragState = null;
  },

  _applySavedOrder(root) {
    if (this._applyingOrder) return;
    const raw = String(Zotero.Prefs.get(this._orderPref, true) || "");
    if (!raw) return;
    const desired = raw.split(",").filter(Boolean);
    const container = this._getContainer(root);
    if (!container || !desired.length) return;
    const entries = this._readEntries(root);
    const actual = entries.map(entry => entry.id);
    if (desired.every((id, index) => actual[index] === id)) return;
    this._applyingOrder = true;
    try {
      for (const id of desired) {
        const entry = this._readEntries(root).find(item => item.id === id);
        if (entry && entry.wrapper) container.appendChild(entry.wrapper);
      }
    } catch (e) {
      this._log("apply saved order failed: " + (e && e.message || e));
    } finally {
      this._applyingOrder = false;
    }
  },
};

Zotero.ItemPaneOrganizer = ItemPaneOrganizer;
