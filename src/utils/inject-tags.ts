export async function injectProTagsInMatchHistory(
    auroraId: number,
    gateway: string,
    alias: string,
    processedOffsets: Set<number>,
    injectedMatchIds: Set<string>,
    akaList: Record<string, { battle_tag: string; aurora_id: number }[]>,
    SUPABASE_HEADERS: Record<string, string>
): Promise<void> {
    const rows = document.querySelectorAll(
        "div.flex.flex-row.gap-2.w-full.items-center"
    );

    const total = rows.length;
    if (total === 0) return;

    const chunkSize = 20;

    for (let offset = 0; offset < total; offset += chunkSize) {
        if (processedOffsets.has(offset)) continue;
        processedOffsets.add(offset);

        const rowsChunk = Array.from(rows).slice(offset, offset + chunkSize);

        const url = `https://xmploueumzkrdvapbyfs.supabase.co/rest/v1/player_matches?select=*&order=timestamp.desc&offset=${offset}&limit=${chunkSize}&aurora_id=eq.${auroraId}&gateway=eq.${gateway}&alias=eq.${encodeURIComponent(alias)}`;

        try {
            const res = await fetch(url, { headers: SUPABASE_HEADERS });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            rowsChunk.forEach((row, i) => {
                const match = data[i];
                if (!match || injectedMatchIds.has(match.id)) return;

                for (const [aka, accounts] of Object.entries(akaList ?? {})) {
                    if (
                        accounts.some((acc) => acc.aurora_id === match.opponent_aurora_id)
                    ) {
                        const link = row.querySelector("a[href*='/players/gateway/']");
                        if (!link || row.querySelector("[data-pro-tag]")) return;

                        const opponentColorSpan = link.querySelector("span.badge");
                        const textColorClass = Array.from(
                            opponentColorSpan?.classList ?? []
                        ).find((cls) => cls.startsWith("text-") && cls.endsWith("-500"));

                        const tag = document.createElement("div");
                        tag.textContent = `Opponent: ${aka}`;
                        tag.className = `text-xs font-bold ml-2 ${textColorClass ?? "text-yellow-500"}`;
                        tag.setAttribute("data-pro-tag", "true");

                        link.insertAdjacentElement("afterend", tag);
                        injectedMatchIds.add(match.id);
                        break;
                    }
                }
            });
        } catch (err) {
            console.error("[EXT] Failed to inject match history tags:", err);
            return;
        }
    }
}

export function injectProTag(aka: string): void {
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
    tag.textContent = `Alias: ${aka}`;
    battleTagElement.parentNode?.insertBefore(tag, battleTagElement.nextSibling);
}

export function removeInjectedProTag(): void {
    const tag = document.querySelector("[data-pro-tag]");
    if (tag?.parentNode) {
        tag.parentNode.removeChild(tag);
    }
}
