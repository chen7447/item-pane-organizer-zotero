"use strict";

var chromeHandle;

function logError(error) {
  try { Zotero.debug("[ItemPaneOrganizer][bootstrap] " + (error && (error.stack || error.message) || error)); } catch (e) {}
}

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  try {
    await Zotero.initializationPromise;
    rootURI = rootURI || resourceURI.spec;
    try { ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs"); } catch (e) {}
    const am = Components.classes["@mozilla.org/addons/addon-manager-startup;1"]
      .getService(Components.interfaces.amIAddonManagerStartup);
    chromeHandle = am.registerChrome(Services.io.newURI(rootURI + "manifest.json"), [
      ["content", "itempaneorganizer", rootURI + "content/"],
      ["locale", "itempaneorganizer", "en-US", rootURI + "locale/en-US/"],
      ["locale", "itempaneorganizer", "zh-CN", rootURI + "locale/zh-CN/"],
    ]);
    const ctx = { addonID: id, addonVersion: version, addonRoot: rootURI, Zotero, Services, Components };
    Services.scriptloader.loadSubScript(rootURI + "content/scripts/addon.js", ctx);
    await Zotero.ItemPaneOrganizer.init();
  } catch (e) { logError(e); }
}

function shutdown(data, reason) {
  if (reason === APP_SHUTDOWN) return;
  try { if (Zotero.ItemPaneOrganizer) Zotero.ItemPaneOrganizer.shutdown(reason); } catch (e) { logError(e); }
  try { if (chromeHandle) chromeHandle.destruct(); } catch (e) {}
  chromeHandle = null;
}

function uninstall(data, reason) {}
