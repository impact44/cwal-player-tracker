import { useEffect, useState } from "react";
import browser from "webextension-polyfill";

type Props = {
    onSaved?: () => void;
};

type Settings = {
    spoilerFree?: boolean;
};

export default function SettingsPanel({ onSaved }: Props) {
    const [spoilerFree, setSpoilerFree] = useState(false);
    const storage = browser.storage.local;

    useEffect(() => {
        storage.get("settings").then(({ settings }) => {
            setSpoilerFree(Boolean((settings as Settings)?.spoilerFree));
        });
    }, []);

    const notifyActiveTab = (enabled: boolean) => {
        browser.tabs
            .query({ active: true, currentWindow: true })
            .then((tabs) => {
                const tab = tabs[0];
                if (tab?.id !== undefined) {
                    browser.tabs.sendMessage(tab.id, {
                        type: "SET_SPOILER_MODE",
                        enabled,
                    });
                }
            })
            .catch(() => { });
    };

    const onToggle = async (enabled: boolean) => {
        setSpoilerFree(enabled);
        const { settings } = await storage.get("settings");
        const next: Settings = { ...(settings || {}), spoilerFree: enabled };
        await storage.set({ settings: next });
        notifyActiveTab(enabled);
        onSaved?.();
    };

    return (
        <div style={{ fontSize: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                    type="checkbox"
                    checked={spoilerFree}
                    onChange={(e) => onToggle(e.target.checked)}
                />
                Enable Spoiler-Free Browsing
            </label>
            <p style={{ marginTop: 8, color: "#999", lineHeight: 1.4 }}>
                When enabled, the extension will remove certain colors and text from
                the match history to reduce spoilers. You can change this anytime.
            </p>
        </div>
    );
}
