import { useState } from 'react'
import ImportExportPanel from './components/ImportExportPanel'
import ViewListPanel from './components/ViewListPanel'
import DashboardPanel from './components/DashboardPanel'
import { FaGithub, FaDiscord } from 'react-icons/fa'
import './styles/App.css'
import './styles/ConfirmModal.css'
import './styles/ViewList.css'
import './styles/Dashboard.css'

const SECTIONS = [
  { label: 'General', items: ['Dashboard', 'Help'] },
  { label: 'Manage List', items: ['Import/Export List', 'View List', 'Remove Player'] }
]

function App() {
  const [active, setActive] = useState('Dashboard')
  const [status, setStatus] = useState<string | null>(null)

  const handleMenuChange = (menu: string) => {
    setActive(menu)
    setStatus(null) // Clear status on menu change
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="app-title">cwal.gg Player Tracker</div>

        {SECTIONS.map(section => (
          <div key={section.label} className="section">
            <div className="section-label">{section.label}</div>
            {section.items.map(item => (
              <button
                key={item}
                className={`menu-item ${active === item ? 'active' : ''}`}
                onClick={() => handleMenuChange(item)}
              >
                {item}
              </button>
            ))}
          </div>
        ))}

        <div className="sidebar-icons">
          <a href="https://github.com/impact44/cwal-player-tracker" target="_blank" rel="noopener noreferrer">
            <FaGithub size={20} />
          </a>
          <a href="https://discord.gg/SPbAkhNsFM" target="_blank" rel="noopener noreferrer">
            <FaDiscord size={20} />
          </a>
        </div>
      </aside>


      {/* Right Panel */}
      <main className="main-panel">
        <div className="panel-header">{active}</div>
        <div className="panel-content">
          {active === 'Import/Export List' && (
            <ImportExportPanel status={status} setStatus={setStatus} />
          )}

          {active === 'Dashboard' && <DashboardPanel />}

          {active === 'Help' && (
            <p style={{ fontSize: '14px', color: '#aaa' }}>
              Help section coming soon!
            </p>
          )}

          {active === 'View List' && <ViewListPanel />}

          {active === 'Remove Player' && (
            <p style={{ fontSize: '14px', color: '#aaa' }}>
              Remove Player coming soon! For now, you can remove players by navigating to their corresponding profile on cwal.gg
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
