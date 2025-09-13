import browser from 'webextension-polyfill';
import React, { useState } from 'react'

type Props = {
    status: string | null
    setStatus: (value: string | null) => void
}

const ImportExportPanel: React.FC<Props> = ({ status, setStatus }) => {
    const [confirming, setConfirming] = useState<null | 'default' | 'reset'>(null)

    // Use browser-polyfill for tabs API
    const notifyContentScript = () => {
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs: any[]) => {
            const tab = tabs[0];
            if (tab?.id !== undefined && tab.url?.includes("cwal.gg/players")) {
                browser.tabs.sendMessage(tab.id, { type: 'RELOAD_AKA_LIST' });
            } else {
                // console.warn("No eligible tab to send RELOAD_AKA_LIST.");
            }
        });
    }

    const storageLocal = browser.storage.local;

    const handleExport = () => {
        storageLocal.get('aka_list').then((result: any) => {
            const akaList = result.aka_list || {};
            const blob = new Blob([JSON.stringify(akaList, null, 2)], {
                type: 'application/json',
            });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'aka_list.json';
            a.click();
            URL.revokeObjectURL(url);

            setStatus('List exported successfully.');
            notifyContentScript();
        });
    }

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target?.result as string);
                if (typeof imported !== 'object' || Array.isArray(imported))
                    throw new Error('Invalid format');

                storageLocal.set({ aka_list: imported }).then(() => {
                    setStatus('List imported and saved.');
                    notifyContentScript();
                });
            } catch (err) {
                setStatus('Failed to import: invalid file format.');
            }
        };

        reader.readAsText(file);
    }

    const handleImportDefault = async () => {
        try {
            const res = await fetch('/default_list.json');
            if (!res.ok) throw new Error('Failed to fetch default list');
            const data = await res.json();

            storageLocal.set({ aka_list: data }).then(() => {
                setStatus('Default list imported.');
                notifyContentScript();
            });
        } catch (err) {
            setStatus('Failed to import default list.');
        } finally {
            setConfirming(null);
        }
    }

    const handleReset = () => {
        storageLocal.set({ aka_list: {} }).then(() => {
            setStatus('List has been reset.');
            notifyContentScript();
            setConfirming(null);
        });
    }

    const renderSection = (title: string, tooltip: string, action: React.ReactNode) => (
        <div className="panel-section" title={tooltip}>
            <div className="panel-section-title">{title}</div>
            {action}
        </div>
    )

    return (
        <div className="import-export-container">
            {status && <div className="status-banner">{status}</div>}

            {renderSection(
                'Export List',
                'Export your current list in a .json file',
                <button onClick={handleExport} className="action-button">Export</button>
            )}

            {renderSection(
                'Import External List',
                'Import an alias list in .json format',
                <label className="action-button" style={{ cursor: 'pointer' }}>
                    Import
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        style={{ display: 'none' }}
                    />
                </label>
            )}

            {renderSection(
                'Import Default List',
                'Imports a default list which tracks over 100 active pro/amateur players',
                <button className="action-button warn" onClick={() => setConfirming('default')}>
                    Import Default
                </button>
            )}

            {renderSection(
                'Reset List',
                'Completely resets your list',
                <button className="action-button warn" onClick={() => setConfirming('reset')}>
                    Reset
                </button>
            )}

            {confirming && (
                <div className="modal-overlay">
                    <div className="modal-box">
                        <p>This will overwrite your current list. Are you sure?</p>
                        <div className="confirm-actions">
                            {confirming === 'reset' && (
                                <button className="confirm-yes" onClick={handleReset}>
                                    Yes, reset
                                </button>
                            )}
                            {confirming === 'default' && (
                                <button className="confirm-yes" onClick={handleImportDefault}>
                                    Yes, import default
                                </button>
                            )}
                            <button className="confirm-no" onClick={() => setConfirming(null)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ImportExportPanel
