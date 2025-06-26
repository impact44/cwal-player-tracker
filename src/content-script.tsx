import { SUPABASE_HEADERS } from "./utils/supabase";

(() => {
  if ((window as any).hasRunProTagScript) return;
  (window as any).hasRunProTagScript = true;

  const injectedMatchIds = new Set<string>();
  let PRO_MAP: Record<
    string,
    { battle_tag: string; aurora_id: string }
  > | null = null;
  let cachedBattleTag: string | null = null;
  let cachedAuroraId: string | null = null;
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
  ): Promise<string | null> {
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
    const container = document.querySelector(
      "div.flex.flex-row.w-full.gap-4.items-end"
    );
    const battleTagElement = container?.querySelector(
      "h3.font-bold.leading-\\[1em\\].items-end.trim.font-mono"
    );
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
    battleTagElement.parentNode?.insertBefore(
      tag,
      battleTagElement.nextSibling
    );
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

  async function injectProTagsInMatchHistory(
    auroraId: string,
    gateway: string,
    alias: string
  ): Promise<void> {
    console.log("[EXT] 🧪 injectProTagsInMatchHistory triggered", {
      auroraId,
      gateway,
      alias,
    });

    const rows = document.querySelectorAll(
      "div.flex.flex-row.gap-2.w-full.items-center"
    );

    const total = rows.length;
    if (total === 0) {
      return;
    }

    const chunkSize = 20;

    for (let offset = 0; offset < total; offset += chunkSize) {
      if (processedOffsets.has(offset)) {
        continue;
      }
      processedOffsets.add(offset);

      const rowsChunk = Array.from(rows).slice(offset, offset + chunkSize);

      const url = `https://xmploueumzkrdvapbyfs.supabase.co/rest/v1/player_matches?select=*&order=timestamp.desc&offset=${offset}&limit=${chunkSize}&aurora_id=eq.${auroraId}&gateway=eq.${gateway}&alias=eq.${encodeURIComponent(
        alias
      )}`;

      try {
        const res = await fetch(url, { headers: SUPABASE_HEADERS });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        console.log(
          `[EXT] 📦 Fetched ${data.length} matches from Supabase (offset ${offset})`
        );

        rowsChunk.forEach((row, i) => {
          const match = data[i];
          if (!match || injectedMatchIds.has(match.id)) return;

          for (const [proName, { aurora_id }] of Object.entries(
            PRO_MAP ?? {}
          )) {
            const proId = parseInt(aurora_id);
            if (proId === match.opponent_aurora_id) {
              const link = row.querySelector("a[href*='/players/gateway/']");
              if (!link) continue;
              if (row.querySelector("[data-pro-tag]")) continue;

              const opponentColorSpan = link.querySelector("span.badge");
              const textColorClass = Array.from(
                opponentColorSpan?.classList ?? []
              ).find((cls) => cls.startsWith("text-") && cls.endsWith("-500"));

              const tag = document.createElement("div");
              tag.textContent = `Opponent: ${proName}`;
              tag.className = `text-xs font-bold ml-2 ${
                textColorClass ?? "text-yellow-500"
              }`;
              tag.setAttribute("data-pro-tag", "true");

              link.insertAdjacentElement("afterend", tag);
              injectedMatchIds.add(match.id);
              break;
            }
          }
        });
      } catch (err) {
        console.error("[EXT] ❌ Failed to inject match history tags:", err);
        return;
      }
    }
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
        PRO_MAP &&
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
    auroraId: string,
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

        injectProTagsInMatchHistory(auroraId, gateway, alias);
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
    const auroraId = await fetchAuroraId(alias, gateway);
    if (!auroraId) return;
    cachedAuroraId = auroraId;

    const profileContainer = await waitForElement("div.flex.flex-col", 5000);
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
    tryMatch(cachedBattleTag, auroraId);
    observeAliasWipe(); // Watch for tag removal

    injectProTagsInMatchHistory(auroraId, gateway, alias);
    observeMatchHistoryUpdates(cachedAuroraId, gateway, alias);
  }

  chrome.storage.local.get("pro_map", (result) => {
    if (!result.pro_map) {
      console.error("[EXT] ❌ pro_map not found in chrome.storage.local");
      return;
    }

    PRO_MAP = result.pro_map;
    console.log(
      "[EXT] ✅ Pro map loaded:",
      Object.keys(PRO_MAP ?? {}).length,
      "entries"
    );

    if (location.href.includes("/players/")) {
      resetAndRerun();
    }
  });

  patchPushReplaceState();
  observeUrlChange();
})();
