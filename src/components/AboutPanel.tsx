import React, { useEffect, useState } from 'react'

const AboutPanel: React.FC = () => {
    const [version, setVersion] = useState<string>('')

    useEffect(() => {
        const manifest = chrome.runtime.getManifest()
        setVersion(manifest.version)
    }, [])

    return (
        <div className="about-container" style={{ fontSize: 14, color: '#ddd', padding: 16 }}>
            <div className="version-box" style={{ marginBottom: 16, padding: 0 }}>
                <span className="version-label" style={{ fontWeight: 'bold' }}>Extension Version:</span> {version}
            </div>
            <div style={{ marginBottom: 32 }}>
                <div style={{ fontWeight: 'bold', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '2px solid #444', marginBottom: 6 }}>What's New?</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Spoiler-Free Browsing toggle in Settings</li>
                    <li>Firefox/Brave Support</li>
                    <li>Bug fixes</li>
                </ul>
            </div>
            <div>
                <div style={{ fontWeight: 'bold', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '2px solid #444', marginBottom: 6 }}>Important</div>
                <div>
                    If this is your first time using the app, please import the <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>default list</span> from the <span style={{ fontWeight: 'bold' }}>Import/Export List</span> menu.
                </div>
            </div>
        </div >
    )
}

export default AboutPanel