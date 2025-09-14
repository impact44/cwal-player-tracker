// src/utils/spoiler-mode.ts
import browser from "webextension-polyfill";

type Settings = { spoilerFree?: boolean };

/** Neutral palette (tweak if you like) */
const NEUTRAL_BORDER = "rgb(156, 163, 175)"; // tailwind gray-400-ish
const NEUTRAL_TEXT = "rgb(156, 163, 175)";
const NEUTRAL_BG_20 = "rgba(156, 163, 175, 0.22)";

/** Select all match “cards” (win/lose rows) */
function matchCardRoots(): HTMLElement[] {
    return Array.from(
        document.querySelectorAll(
            "div.grow.flex.flex-col.rounded-l.border-l-4.bg-base-100"
        )
    ) as HTMLElement[];
}

/** Result line container (green/red text) */
function findResultWrap(card: HTMLElement): HTMLElement | null {
    return (card.querySelector(
        "span.flex.flex-row.text-green-600, span.flex.flex-row.text-red-600"
    ) as HTMLElement | null) ?? null;
}

/** Tailwind responsive classes need escaped colons for querySelector */
function findLabelSpan(resultWrap: HTMLElement): HTMLElement | null {
    // Try a few variants; fall back to any bold name span
    return (
        (resultWrap.querySelector(
            "span.-sm\\:hidden.font-bold.min-w-max"
        ) as HTMLElement | null) ||
        (resultWrap.querySelector(
            "span.sm\\:hidden.font-bold.min-w-max"
        ) as HTMLElement | null) ||
        (resultWrap.querySelector(
            "span.font-bold.min-w-max"
        ) as HTMLElement | null) ||
        null
    );
}

/** The +/- MMR delta span next to the label */
function findDeltaSpan(
    resultWrap: HTMLElement,
    label: HTMLElement | null
): HTMLElement | null {
    const spans = Array.from(
        resultWrap.querySelectorAll("span")
    ) as HTMLElement[];
    return (
        spans.find(
            (s) => s !== label && /^\s*[+\-]?\d+\s*$/.test(s.textContent || "")
        ) || null
    );
}

/** Idempotent: apply neutral look to one match card */
function applyToCard(card: HTMLElement): void {
    try {
        if (card.dataset.extSpoilerApplied === "1") return;
        card.dataset.extSpoilerApplied = "1";

        // 1) Neutralize colored left border (keeps width from border-l-4)
        card.dataset.extPrevBorder = card.style.borderLeftColor || "";
        card.style.borderLeftColor = NEUTRAL_BORDER;

        // 2) Neutralize the header stripe overlay color
        const header = card.querySelector(
            ".grid.grid-cols-3.w-full.content-evenly.bg-base-300.text-sm.py-1.px-3"
        ) as HTMLElement | null;
        if (header) {
            header.dataset.extPrevBg = header.style.backgroundColor || "";
            header.style.backgroundColor = NEUTRAL_BG_20; // inline override
        }

        // 3/4/5) Left header result line
        const resultWrap = findResultWrap(card);
        if (resultWrap) {
            // text color → neutral
            resultWrap.dataset.extPrevColor = resultWrap.style.color || "";
            resultWrap.style.color = NEUTRAL_TEXT;

            // label “Victory/Defeat” → “Spoiler-Free Mode”
            const label = findLabelSpan(resultWrap);
            if (label) {
                label.dataset.extPrevText = label.textContent || "";
                label.textContent = "Spoiler-Free";
            }

            // hide +/- MMR delta
            const delta = findDeltaSpan(resultWrap, label);
            if (delta) {
                delta.dataset.extPrevText = delta.textContent || "";
                delta.textContent = ""; // or: delta.remove()
            }
        }
    } catch (e) {
        // Never let one bad row stop the rest
        console.debug("[EXT] spoiler apply error", e);
    }
}

/** Idempotent: restore the original look */
function revertFromCard(card: HTMLElement): void {
    try {
        if (card.dataset.extSpoilerApplied !== "1") return;
        card.dataset.extSpoilerApplied = "0";

        // border color
        card.style.borderLeftColor = card.dataset.extPrevBorder || "";
        delete card.dataset.extPrevBorder;

        // header overlay
        const header = card.querySelector(
            ".grid.grid-cols-3.w-full.content-evenly.bg-base-300.text-sm.py-1.px-3"
        ) as HTMLElement | null;
        if (header) {
            header.style.backgroundColor = header.dataset.extPrevBg || "";
            delete header.dataset.extPrevBg;
        }

        // result wrap resets
        const resultWrap = findResultWrap(card);
        if (resultWrap) {
            resultWrap.style.color = resultWrap.dataset.extPrevColor || "";
            delete resultWrap.dataset.extPrevColor;

            const label = findLabelSpan(resultWrap);
            if (label && "extPrevText" in label.dataset) {
                label.textContent = label.dataset.extPrevText || "";
                delete (label.dataset as any).extPrevText;
            }

            const delta = findDeltaSpan(resultWrap, label);
            if (delta && "extPrevText" in delta.dataset) {
                delta.textContent = delta.dataset.extPrevText || "";
                delete (delta.dataset as any).extPrevText;
            }
        }
    } catch (e) {
        console.debug("[EXT] spoiler revert error", e);
    }
}

export function applySpoilerModeToVisibleMatches(): void {
    matchCardRoots().forEach(applyToCard);
}

export function revertSpoilerModeFromVisibleMatches(): void {
    matchCardRoots().forEach(revertFromCard);
}

/** Full init: reads setting, applies now, and keeps in sync with popup toggles. */
export async function initSpoilerMode(reapplyHook?: () => void) {
    const raw = await browser.storage.local.get("settings");
    const settings = (raw?.settings ?? {}) as Settings;
    const enabled = !!settings.spoilerFree;

    if (enabled) applySpoilerModeToVisibleMatches();
    else revertSpoilerModeFromVisibleMatches();

    // Live toggle from popup
    browser.runtime.onMessage.addListener((msg: any) => {
        if (msg?.type === "SET_SPOILER_MODE") {
            if (msg.enabled) applySpoilerModeToVisibleMatches();
            else revertSpoilerModeFromVisibleMatches();
        }
        return false;
    });

    // Keep a hook if caller wants to re-apply after its own injections
    if (reapplyHook) reapplyHook();
}
