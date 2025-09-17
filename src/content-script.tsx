import browser from 'webextension-polyfill';
import { SUPABASE_HEADERS } from "./utils/supabase";
import { injectAkaButtons } from "./utils/inject-buttons";
import { addAkaToStorage, removeAkaFromStorage, exportAkaList, importAkaList } from "./utils/storage-helpers";
import { injectProTagsInMatchHistory, injectProTag, removeInjectedProTag } from "./utils/inject-tags";
import {
  initSpoilerMode,
  applySpoilerModeToVisibleMatches,
  revertSpoilerModeFromVisibleMatches
} from "./utils/spoiler-mode";


// Use browser-polyfill for cross-browser storage API
const storageLocal = browser.storage.local;

// Expose functions to the global window object for debugging
(window as any).exportAkaList = exportAkaList;
(window as any).importAkaList = importAkaList;

(() => {
  if ((window as any).hasRunProTagScript) return;
  (window as any).hasRunProTagScript = true;

  const injectedMatchIds = new Set<string>();
  let AKA_MAP: Record<string, { battle_tag: string; aurora_id: number }[]> | null = null;
  let cachedBattleTag: string | null = null;
  let cachedAuroraId: number | null = null;
  let alreadyInjected = false;
  let lastUrl: string = location.href;
  let matchObserver: MutationObserver | null = null;
  const processedOffsets = new Set<number>();

  initSpoilerMode();

  console.debug("Debug to silence error:", {
    alreadyInjected,
  });

  // This prevents the function inject function from being called too frequently
  function debounce<T extends (...args: any[]) => void>(
    fn: T,
    delay: number
  ): T {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return function (...args: Parameters<T>) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    } as T;
  }

  function extractAliasAndGatewayFromUrl(
    url: string
  ): { gateway: string; alias: string } | null {
    const match = url.match(/\/players\/gateway\/(\d+)\/player\/([^\/?#]+)/);
    if (!match) return null;
    return {
      gateway: match[1],
      alias: decodeURIComponent(match[2]),
    };
  }

  function resetSessionState(): void {
    injectedMatchIds.clear();
    cachedAuroraId = null;
    cachedBattleTag = null;
    alreadyInjected = false;
    processedOffsets.clear();
  }

  browser.runtime.onMessage.addListener((message: any) => {
    if (message.type === 'RELOAD_AKA_LIST') {
      resetAndRerun();
      return { success: true }; // polyfill resolves the sender's promise
    }
  });

  async function fetchAuroraId(
    alias: string,
    gateway: string
  ): Promise<number | null> {
    const encodedAlias = encodeURIComponent(alias);
    const url = `https://xmploueumzkrdvapbyfs.supabase.co/rest/v1/player_profile_view?select=*&alias=eq.${encodedAlias}&gateway=eq.${gateway}`;
    try {
      const res = await fetch(url, { headers: SUPABASE_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const id = data?.[0]?.battlenet_account;
      return id !== undefined && id !== null ? Number(id) : null;
    } catch (err) {
      console.error("[EXT] ❌ Failed to fetch aurora_id", err);
      return null;
    }
  }

  function tryMatch(battleTag: string, auroraId: number): boolean {
    removeInjectedProTag(); // Always clear the tag first

    if (!AKA_MAP) return false;

    for (const [aka, accounts] of Object.entries(AKA_MAP)) {
      for (const account of accounts) {
        const storedAuroraId = Number(account.aurora_id);
        const storedBattleTag = account.battle_tag;
        if (storedAuroraId === auroraId && storedBattleTag === battleTag) {
          injectProTag(aka);
          return true;
        }
      }
    }

    return false;
  }

  function waitForElement(
    selector: string,
    timeout = 3000
  ): Promise<Element | null> {
    const interval = 100;
    const maxTries = timeout / interval;
    let tries = 0;

    return new Promise((resolve) => {
      const check = () => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (++tries >= maxTries) return resolve(null);
        setTimeout(check, interval);
      };
      check();
    });
  }

  function observeAliasWipe(): void {
    const container = document.querySelector(
      "div.flex.flex-row.w-full.gap-4.items-end"
    );
    if (!container) return;

    const observer = new MutationObserver(() => {
      const exists = container.querySelector("[data-pro-tag]");
      const tagText = container
        .querySelector(
          "h3.font-bold.leading-\\[1em\\].items-end.trim.font-mono"
        )
        ?.textContent?.trim();
      const currentTag =
        tagText?.startsWith("/") && tagText.endsWith("/")
          ? tagText.slice(1, -1).trim()
          : tagText;

      if (
        !exists &&
        AKA_MAP &&
        cachedBattleTag &&
        cachedAuroraId &&
        currentTag === cachedBattleTag
      ) {
        tryMatch(cachedBattleTag, cachedAuroraId);
      }
    });

    observer.observe(container, { childList: true, subtree: true });
  }

  type Settings = { spoilerFree?: boolean };
  let SPOILER_ON = false;

  function checkApplySpoiler() {
    if (SPOILER_ON) applySpoilerModeToVisibleMatches();
    else revertSpoilerModeFromVisibleMatches();
  }

  browser.storage.local.get("settings").then(({ settings }) => {
    SPOILER_ON = Boolean((settings as Settings)?.spoilerFree);
    if (SPOILER_ON) applySpoilerModeToVisibleMatches();
    else revertSpoilerModeFromVisibleMatches();
  });

  // instant DOM update when the setting changes
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.settings) return;

    const next = (changes.settings.newValue ?? {}) as Settings;
    const prev = (changes.settings.oldValue ?? {}) as Settings;

    const nextOn = !!next.spoilerFree;
    const prevOn = !!prev.spoilerFree;
    if (nextOn === prevOn) return; // no change

    SPOILER_ON = nextOn;
    if (SPOILER_ON) applySpoilerModeToVisibleMatches();
    else revertSpoilerModeFromVisibleMatches();
  });


  function observeMatchHistoryUpdates(
    auroraId: number,
    gateway: string,
    alias: string
  ): void {
    const container = document.querySelector("div.flex.flex-col");
    if (!container) return;

    // Disconnect any previously attached observer
    if (matchObserver) {
      matchObserver.disconnect();
      matchObserver = null;
    }

    matchObserver = new MutationObserver(
      debounce((mutations) => {
        const hasMeaningfulChange = mutations.some((m) =>
          Array.from(m.addedNodes).some(
            (n) =>
              n instanceof HTMLElement &&
              n.matches("div.flex.flex-row.gap-2.w-full.items-center")
          )
        );
        if (!hasMeaningfulChange) return;

        injectProTagsInMatchHistory(
          auroraId,
          gateway,
          alias,
          processedOffsets,
          injectedMatchIds,
          AKA_MAP!,
          SUPABASE_HEADERS
        );

        // Check and apply spoiler mode if enabled
        checkApplySpoiler();
      }, 100)
    );

    matchObserver.observe(container, { childList: true, subtree: true });
  }

  function patchPushReplaceState(): void {
    const rawPush = history.pushState;
    const rawReplace = history.replaceState;

    history.pushState = function (...args) {
      rawPush.apply(this, args);
      window.dispatchEvent(new Event("locationchange"));
    };

    history.replaceState = function (...args) {
      rawReplace.apply(this, args);
      window.dispatchEvent(new Event("locationchange"));
    };

    window.addEventListener("popstate", () => {
      window.dispatchEvent(new Event("locationchange"));
    });

    window.addEventListener("locationchange", () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        // Small delay to ensure DOM is painted
        setTimeout(() => {
          resetAndRerun();
        }, 200);
      }
    });
  }

  function observeUrlChange(): void {
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        resetAndRerun();
      }
    });
    observer.observe(document, { subtree: true, childList: true });
  }

  function injectFloatingButton() {
    if (document.getElementById("cwal-ext-icon")) return;

    // === Floating Button ===
    const btn = document.createElement("img");
    btn.src = browser.runtime.getURL("icons/icon128.png");
    btn.id = "cwal-ext-icon";
    btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 44px;
    height: 44px;
    border-radius: 6px;
    border: 2px solid white;
    background-color: #000;
    z-index: 999999;
    cursor: pointer;
  `;

    btn.addEventListener("click", () => {
      const existing = document.getElementById("cwal-ext-modal");
      if (existing) {
        existing.remove();
        return;
      }

      // === Transparent Overlay for Outside Click Detection ===
      const overlay = document.createElement("div");
      overlay.id = "cwal-ext-modal";
      overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: transparent;
      z-index: 999998;
    `;

      // === Iframe Panel next to Icon (bottom-right) ===
      const iframe = document.createElement("iframe");
      iframe.src = browser.runtime.getURL("index.html");
      iframe.style.cssText = `
      position: fixed;
      bottom: 75px;
      right: 20px;
      width: 590px;
      height: 490px;
      border: none;
      border-radius: 10px;
      background: transparent;
      box-shadow: 0 0 14px rgba(0, 0, 0, 0.6);
      z-index: 999999;
    `;

      overlay.appendChild(iframe);

      // Close panel when clicking outside the iframe
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
      });

      document.body.appendChild(overlay);
    });

    document.body.appendChild(btn);
  }


  async function resetAndRerun(): Promise<void> {
    resetSessionState();
    matchObserver?.disconnect(); // Clean up old observer

    const parsed = extractAliasAndGatewayFromUrl(location.href);
    if (!parsed) return;

    const { alias, gateway } = parsed;
    const auroraId: number | null = await fetchAuroraId(alias, gateway);
    if (!auroraId) return;
    cachedAuroraId = auroraId;

    const profileContainer = await waitForElement(
      "div.flex.flex-row.justify-end.form-control.w-full.gap-2",
      5000
    );
    if (!profileContainer) {
      console.warn("[EXT] ⚠️ Profile container not found within timeout");
      return;
    }

    const tagEl = await waitForElement(
      "h3.font-bold.leading-\\[1em\\].items-end.trim.font-mono",
      2000
    );
    if (!tagEl) return;

    const raw = tagEl.textContent?.trim();
    if (!raw) return;

    cachedBattleTag =
      raw.startsWith("/") && raw.endsWith("/") ? raw.slice(1, -1).trim() : raw;

    // 🔁 Always refresh the latest list before injecting anything
    storageLocal.get("aka_list").then((result: any) => {
      AKA_MAP = result.aka_list ?? {};

      tryMatch(cachedBattleTag!, auroraId);
      observeAliasWipe();

      injectProTagsInMatchHistory(
        auroraId,
        gateway,
        alias,
        processedOffsets,
        injectedMatchIds,
        AKA_MAP!,
        SUPABASE_HEADERS
      );
      observeMatchHistoryUpdates(auroraId, gateway, alias);

      checkApplySpoiler();
    });

    if (!alreadyInjected && cachedBattleTag) {
      alreadyInjected = true;

      injectAkaButtons(
        profileContainer as HTMLElement,
        (aka: string) => {
          addAkaToStorage(aka, auroraId, cachedBattleTag!);
          resetAndRerun(); // rerun after adding
        },
        () => {
          removeAkaFromStorage(auroraId);
          resetAndRerun(); // rerun after removing
        }
      );
    }

    // Always re-apply spoiler mode at the end
    checkApplySpoiler();
  }

  storageLocal.get("aka_list").then((result: any) => {
    if (!result.aka_list) {
      console.log("[EXT] ⚠️ aka_list not found in storage.local");
      return;
    }

    AKA_MAP = result.aka_list;
    console.log(
      "[EXT] Alias list loaded:",
      Object.keys(AKA_MAP ?? {}).length,
      "entries"
    );

    if (location.href.includes("/players/")) {
      resetAndRerun();
    }
  });
  injectFloatingButton();
  patchPushReplaceState();
  observeUrlChange();

  // Listen for browser navigation (back/forward) and refresh injected UI
  window.addEventListener('popstate', () => {
    setTimeout(() => {
      if (typeof resetAndRerun === 'function') {
        resetAndRerun();
      }
    }, 500);
  });
})();
