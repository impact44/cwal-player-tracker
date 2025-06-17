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

  const SUPABASE_HEADERS: Record<string, string> = {
    apikey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtcGxvdWV1bXprcmR2YXBieWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzI4ODY5MTQsImV4cCI6MTk4ODQ2MjkxNH0.p8Jkm2fnFzzy7YYdCs0NVjBdqLmUzvBFJjdf3V0bHuo",
    Authorization:
      "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtcGxvdWV1bXprcmR2YXBieWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzI4ODY5MTQsImV4cCI6MTk4ODQ2MjkxNH0.p8Jkm2fnFzzy7YYdCs0NVjBdqLmUzvBFJjdf3V0bHuo",
  };

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
      const id = data?.[0]?.battlenet_account;
      return id?.toString() || null;
    } catch (err) {
      console.error("[EXT] ❌ Failed to fetch aurora_id", err);
      return null;
    }
  }

  function extractBattleTagFromDOM(): string | null {
    const el = document.querySelector(
      "h3.font-bold.leading-\\[1em\\].items-end.trim.font-mono"
    );
    if (!el) return null;
    const raw = el.textContent?.trim();
    return raw?.startsWith("/") && raw.endsWith("/")
      ? raw.slice(1, -1).trim()
      : raw || null;
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
    battleTagElement.parentNode?.insertBefore(tag, battleTagElement.nextSibling);
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

    const tag = extractBattleTagFromDOM();
    if (!tag) return;
    cachedBattleTag = tag;

    tryMatch(tag, auroraId);
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

  fetch(chrome.runtime.getURL("pro_map.json"))
    .then((res) => res.json())
    .then((data) => {
      PRO_MAP = data;
      console.log("[EXT] ✅ Pro map loaded:", Object.keys(PRO_MAP ?? {}).length, "entries");
      if (location.href.includes("/players/")) {
        resetAndRerun();
      }
    })
    .catch((err) => console.error("[EXT] ❌ Failed to load pro_map.json", err));

  patchPushReplaceState();
  observeUrlChange();
})();
