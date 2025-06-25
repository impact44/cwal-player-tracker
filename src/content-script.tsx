import { SUPABASE_HEADERS } from "./utils/supabase";

(() => {
  if ((window as any).hasRunProTagScript) return;
  (window as any).hasRunProTagScript = true;

  let PRO_MAP: Record<string, { battle_tag: string; aurora_id: string }> | null = null;
  let cachedBattleTag: string | null = null;
  let cachedAuroraId: string | null = null;
  let alreadyInjected = false;
  let currentPageId: string | null = null;
  let lastUrl: string = location.href;

  console.debug("Debug to silence error:", { cachedBattleTag, cachedAuroraId, alreadyInjected });

  function extractAliasAndGatewayFromUrl(url: string): { gateway: string; alias: string } | null {
    const match = url.match(/\/players\/gateway\/(\d+)\/player\/([^\/?#]+)/);
    if (!match) return null;
    return {
      gateway: match[1],
      alias: decodeURIComponent(match[2]),
    };
  }

  async function fetchAuroraId(alias: string, gateway: string): Promise<string | null> {
    const encodedAlias = encodeURIComponent(alias);
    const url = `https://xmploueumzkrdvapbyfs.supabase.co/rest/v1/player_profile_view?select=*&alias=eq.${encodedAlias}&gateway=eq.${gateway}`;
    try {
      const res = await fetch(url, { headers: SUPABASE_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data?.[0]?.battlenet_account?.toString() || null;
    } catch (err) {
      console.error("[EXT] ❌ Failed to fetch aurora_id", err);
      return null;
    }
  }
  
  function tryMatch(battleTag: string, auroraId: string): boolean {
    if (!PRO_MAP) return false;
    for (const [proName, info] of Object.entries(PRO_MAP)) {
      if (
        info.battle_tag === battleTag ||
        parseInt(info.aurora_id) === parseInt(auroraId)
      ) {
        injectProTag(proName);
        return true;
      }
    }
    return false;
  }

  function injectProTag(proName: string): void {
    const container = document.querySelector("div.flex.flex-row.w-full.gap-4.items-end");
    const battleTagElement = container?.querySelector("h3.font-bold.leading-\\[1em\\].items-end.trim.font-mono");
    if (!container || !battleTagElement) {
      console.warn("[EXT] ⚠️ Could not find injection point.");
      return;
    }

    const existing = container.querySelector("[data-pro-tag]");
    if (existing) existing.remove();

    const tag = document.createElement("h3");
    tag.className = "font-bold leading-[1em] items-end trim font-mono";
    tag.setAttribute("data-pro-tag", "true");
    tag.textContent = `Pro Player: ${proName}`;
    battleTagElement.parentNode?.insertBefore(tag, battleTagElement.nextSibling);
  }

  function waitForElement(selector: string, timeout = 3000): Promise<Element | null> {
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

  async function resetAndRerun(): Promise<void> {
    currentPageId = location.href;
    alreadyInjected = false;
    cachedAuroraId = null;

    const parsed = extractAliasAndGatewayFromUrl(currentPageId);
    if (!parsed) return;

    const { alias, gateway } = parsed;
    const auroraId = await fetchAuroraId(alias, gateway);
    if (!auroraId) return;
    cachedAuroraId = auroraId;

    const profileContainer = await waitForElement("div.flex.flex-col", 5000);
    if (!profileContainer) {
      console.warn("[EXT] ⚠️ Profile container not found within timeout");
      return;
    }

    const tagEl = await waitForElement("h3.font-bold.leading-\\[1em\\].items-end.trim.font-mono", 2000);
    if (!tagEl) return;

    const raw = tagEl.textContent?.trim();
    if (!raw) return;

    cachedBattleTag = raw.startsWith("/") && raw.endsWith("/") ? raw.slice(1, -1).trim() : raw;
    tryMatch(cachedBattleTag, auroraId);
    observeAliasWipe(); // 👈 Added to watch for tag removal
  }

  function observeAliasWipe(): void {
    const container = document.querySelector("div.flex.flex-row.w-full.gap-4.items-end");
    if (!container) return;

    const observer = new MutationObserver(() => {
      const exists = container.querySelector("[data-pro-tag]");
      const tagText = container.querySelector("h3.font-bold.leading-\\[1em\\].items-end.trim.font-mono")?.textContent?.trim();
      const currentTag = tagText?.startsWith("/") && tagText.endsWith("/") ? tagText.slice(1, -1).trim() : tagText;

      if (!exists && PRO_MAP && cachedBattleTag && cachedAuroraId && currentTag === cachedBattleTag) {
        tryMatch(cachedBattleTag, cachedAuroraId);
      }
    });

    observer.observe(container, { childList: true, subtree: true });
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
        resetAndRerun();
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

  chrome.storage.local.get("pro_map", (result) => {
    if (!result.pro_map) {
      console.error("[EXT] ❌ pro_map not found in chrome.storage.local");
      return;
    }

    PRO_MAP = result.pro_map;
    console.log("[EXT] ✅ Pro map loaded:", Object.keys(PRO_MAP ?? {}).length, "entries");

    if (location.href.includes("/players/")) {
      resetAndRerun();
    }
  });

  patchPushReplaceState();
  observeUrlChange();
})();
