import { SUPABASE_HEADERS } from "./utils/supabase";
import { injectAkaButtons } from "./utils/inject-buttons";
import { addAkaToStorage, removeAkaFromStorage } from "./utils/storage-helpers";
import { injectProTagsInMatchHistory, injectProTag, removeInjectedProTag } from "./utils/inject-tags";

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
        if (account.battle_tag === battleTag || storedAuroraId === auroraId) {
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

  function observeMatchHistoryUpdates(
    auroraId: number,
    gateway: string,
    alias: string
  ): void {
    const container = document.querySelector("div.flex.flex-col");
    if (!container) return;

    // 🔄 Disconnect any previously attached observer
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
        }, 100);
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

  async function resetAndRerun(): Promise<void> {
    resetSessionState();

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

    // 🆕 Fetch the latest stored list and run tryMatch
    chrome.storage.local.get("aka_list", (result) => {
      const latestMap = result.aka_list ?? {};
      AKA_MAP = latestMap;
      tryMatch(cachedBattleTag!, auroraId);
    });


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
    observeMatchHistoryUpdates(cachedAuroraId, gateway, alias);

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
  }

  chrome.storage.local.get("aka_list", (result) => {
    if (!result.aka_list) {
      console.error("[EXT] ❌ aka_list not found in chrome.storage.local");
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

  patchPushReplaceState();
  observeUrlChange();
})();
