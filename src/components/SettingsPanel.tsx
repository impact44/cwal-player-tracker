import { useEffect, useState } from "react";
import browser from "webextension-polyfill";

type Props = {
    onSaved?: () => void;
};

type Settings = {
    spoilerFree?: boolean;
    hideShortGames?: boolean; // ← new
};

export default function SettingsPanel({ onSaved }: Props) {
    const [spoilerFree, setSpoilerFree] = useState(false);
    const [hideShortGames, setHideShortGames] = useState(false); // ← new
    const storage = browser.storage.local;

    useEffect(() => {
        storage.get("settings").then(({ settings }) => {
            const s = (settings ?? {}) as Settings;
            setSpoilerFree(!!s.spoilerFree);
            setHideShortGames(!!s.hideShortGames);
        });
    }, []);

    // Best-effort message to active tab
    const sendToActiveTab = (msg: any) => {
        browser.tabs
            .query({ active: true, currentWindow: true })
            .then((tabs) => {
                const tab = tabs[0];
                if (tab?.id !== undefined) {
                    browser.tabs.sendMessage(tab.id, msg).catch(() => { });
                }
            })
            .catch(() => { });
    };

    const saveSettings = async (patch: Partial<Settings>) => {
        const { settings } = await storage.get("settings");
        const next: Settings = { ...(settings ?? {}), ...patch };
        await storage.set({ settings: next });
        onSaved?.();
    };

    // Spoiler-free toggle (existing)
    const onToggleSpoiler = async (enabled: boolean) => {
        setSpoilerFree(enabled);
        await saveSettings({ spoilerFree: enabled });
        sendToActiveTab({ type: "SET_SPOILER_MODE", enabled });
    };

    // New: hide short games default
    const onToggleHideShort = async (enabled: boolean) => {
        setHideShortGames(enabled);
        await saveSettings({ hideShortGames: enabled });
        // Ask the content script to apply once on the current page if present
        sendToActiveTab({ type: "APPLY_HIDE_SHORT_GAMES_ONCE" });
    };

    return (
        <div style={{ fontSize: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                    type="checkbox"
                    checked={spoilerFree}
                    onChange={(e) => onToggleSpoiler(e.target.checked)}
                />
                Enable Spoiler-Free Browsing
            </label>
            <p style={{ marginTop: 8, color: "#999", lineHeight: 1.4 }}>
                When enabled, the extension will remove certain colors and text from the
                match history to reduce spoilers. You can change this anytime.
            </p>

            <div style={{ height: 12 }} />

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                    type="checkbox"
                    checked={hideShortGames}
                    onChange={(e) => onToggleHideShort(e.target.checked)}
                />
                Always hide games under 60 seconds
            </label>
            <p style={{ marginTop: 8, color: "#999", lineHeight: 1.4 }}>
                When enabled, the player page’s “Hide games under 60 seconds” control
                will be turned on automatically in the match history page.
            </p>
        </div>
    );
}

