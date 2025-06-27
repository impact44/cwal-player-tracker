import React, { useState } from 'react'

type Props = {
    status: string | null
    setStatus: (value: string | null) => void
}

const ImportExportPanel: React.FC<Props> = ({ status, setStatus }) => {
    const [confirming, setConfirming] = useState<null | 'default' | 'reset'>(null)

    const notifyContentScript = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0]?.id
            if (tabId !== undefined) {
                chrome.tabs.sendMessage(tabId, { type: 'RELOAD_AKA_LIST' })
            }
        })
    }

    const handleExport = () => {
        chrome.storage.local.get('aka_list', (result) => {
            const akaList = result.aka_list || {}
            const blob = new Blob([JSON.stringify(akaList, null, 2)], {
                type: 'application/json',
            })
            const url = URL.createObjectURL(blob)

            const a = document.createElement('a')
            a.href = url
            a.download = 'aka_list.json'
            a.click()
            URL.revokeObjectURL(url)

            setStatus('List exported successfully.')
            notifyContentScript()
        })
    }

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target?.result as string)
                if (typeof imported !== 'object' || Array.isArray(imported))
                    throw new Error('Invalid format')

                chrome.storage.local.set({ aka_list: imported }, () => {
                    setStatus('List imported and saved.')
                    notifyContentScript()
                })
            } catch (err) {
                setStatus('Failed to import: invalid file format.')
            }
        }

        reader.readAsText(file)
    }

    const handleReset = () => {
        chrome.storage.local.set({ aka_list: {} }, () => {
            setStatus('List has been reset.')
            notifyContentScript()
            setConfirming(null)
        })
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
                            {confirming === 'reset' ? (
                                <button className="confirm-yes" onClick={handleReset}>
                                    Yes, reset
                                </button>
                            ) : (
                                <button className="confirm-yes" disabled>
                                    Yes (not implemented)
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
