import { useEffect } from 'react'
import useStore from './store/useStore'
import Toolbar from './components/Toolbar'
import CanvasView from './components/CanvasView'
import ListView from './components/ListView'
import TaskCreationModal from './components/TaskCreationModal'
import SessionManager from './components/SessionManager'
import SettingsPanel from './components/SettingsPanel'
import ImportExport from './components/ImportExport'

export default function App() {
  const boot = useStore(s => s.boot)
  const loaded = useStore(s => s.loaded)
  const view = useStore(s => s.view)
  const showCreateModal = useStore(s => s.showCreateModal)
  const showSessionManager = useStore(s => s.showSessionManager)
  const showSettings = useStore(s => s.showSettings)
  const showImportExport = useStore(s => s.showImportExport)
  const setShowCreateModal = useStore(s => s.setShowCreateModal)
  const setShowSessionManager = useStore(s => s.setShowSessionManager)
  const setShowSettings = useStore(s => s.setShowSettings)
  const setShowImportExport = useStore(s => s.setShowImportExport)
  const tasks = useStore(s => s.tasks)

  useEffect(() => { boot() }, [boot])

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: '-apple-system, Arial, sans-serif', color: '#888' }}>
        Loading…
      </div>
    )
  }

  const floatingTasks = tasks.filter(t => t.status === 'not_started')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: '-apple-system, Arial, sans-serif', overflow: 'hidden' }}>
      <Toolbar />

      {view === 'canvas'
        ? <>
            {floatingTasks.length === 0 && tasks.filter(t => t.status === 'working').length === 0 && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#bbb', fontSize: 15, pointerEvents: 'none',
                textAlign: 'center', zIndex: 1,
              }}>
                Nothing floating yet — add your first task.
              </div>
            )}
            <CanvasView />
          </>
        : <ListView />
      }

      {showCreateModal && <TaskCreationModal onClose={() => setShowCreateModal(false)} />}
      {showSessionManager && <SessionManager onClose={() => setShowSessionManager(false)} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showImportExport && <ImportExport onClose={() => setShowImportExport(false)} />}
    </div>
  )
}
