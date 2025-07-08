import React, { useEffect, useState } from 'react'

const DashboardPanel: React.FC = () => {
    const [version, setVersion] = useState<string>('')

    useEffect(() => {
        const manifest = chrome.runtime.getManifest()
        setVersion(manifest.version)
    }, [])

    return (
        <div className="dashboard-container">
            <div className="version-box">
                <span className="version-label">Extension Version:</span> {version}
            </div>
        </div>
    )
}

export default DashboardPanel
