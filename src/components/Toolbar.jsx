import { useState, useRef, useEffect } from 'react'
import useStore from '../store/useStore'

export default function Toolbar() {
  const sessions        = useStore(s => s.sessions)
  const activeSessionId = useStore(s => s.activeSessionId)
  const view            = useStore(s => s.view)
  const tasks           = useStore(s => s.tasks)
  const togglePause     = useStore(s => s.togglePause)
  const renameSession   = useStore(s => s.renameSession)
  const switchSession   = useStore(s => s.switchSession)
  const setView         = useStore(s => s.setView)
  const setShowCreateModal  = useStore(s => s.setShowCreateModal)
  const setShowSessionManager = useStore(s => s.setShowSessionManager)
  const setShowSettings     = useStore(s => s.setShowSettings)
  const setShowImportExport = useStore(s => s.setShowImportExport)

  const session = sessions.find(s => s.id === activeSessionId)
  const [editingName, setEditingName]       = useState(false)
  const [nameVal, setNameVal]               = useState('')
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false)
  const nameRef   = useRef(null)
  const pickerRef = useRef(null)

  // Status counters
  const cntFloating  = tasks.filter(t => t.status === 'not_started').length
  const cntWorking   = tasks.filter(t => t.status === 'working').length
  const cntFinished  = tasks.filter(t => t.status === 'finished').length
  const cntDiscarded = tasks.filter(t => t.status === 'discarded').length

  useEffect(() => {
    if (editingName) nameRef.current?.focus()
  }, [editingName])

  useEffect(() => {
    function handleClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target))
        setSessionPickerOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function startRename() {
    setNameVal(session?.name || '')
    setEditingName(true)
  }

  function commitRename() {
    if (nameVal.trim() && session) renameSession(session.id, nameVal.trim())
    setEditingName(false)
  }

  return (
    <div style={styles.toolbar}>
      {/* Left: Logo */}
      <div style={styles.logo}>FLOAT</div>

      {/* Centre: Session name + Pause + Counters */}
      <div style={styles.centre}>
        {editingName
          ? <input
              ref={nameRef}
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingName(false) }}
              style={styles.nameInput}
            />
          : <span style={styles.sessionName} onClick={startRename} title="Click to rename">
              {session?.name || '…'}
            </span>
        }
        <button
          style={{ ...styles.pauseBtn, background: session?.paused ? '#e07b00' : '#eee', color: session?.paused ? '#fff' : '#555' }}
          onClick={togglePause}
          title={session?.paused ? 'Resume' : 'Pause'}
        >
          {session?.paused ? '▶ Resume' : '⏸ Pause'}
        </button>

        {/* Status counters */}
        <div style={styles.counters}>
          <span style={pill('#888',   '#f0f0f0')} title="Not started">{cntFloating} floating</span>
          <span style={pill('#2E75B6','#e8f0fb')} title="Working on it">{cntWorking} working</span>
          <span style={pill('#2E8B57','#e6f4ec')} title="Finished">{cntFinished} done</span>
          <span style={pill('#999',   '#f5f5f5')} title="Discarded">{cntDiscarded} discarded</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div style={styles.right}>
        {/* Session picker */}
        <div style={{ position: 'relative' }} ref={pickerRef}>
          <button style={styles.btn} onClick={() => setSessionPickerOpen(o => !o)} title="Switch session">
            ⇄ Sessions
          </button>
          {sessionPickerOpen && (
            <div style={styles.picker}>
              {sessions.map(s => (
                <div
                  key={s.id}
                  style={{ ...styles.pickerItem, fontWeight: s.id === activeSessionId ? 700 : 400 }}
                  onClick={() => { switchSession(s.id); setSessionPickerOpen(false) }}
                >
                  {s.name}
                  {s.id === activeSessionId && <span style={styles.activePip} />}
                </div>
              ))}
              <div style={styles.pickerDivider} />
              <div
                style={{ ...styles.pickerItem, color: '#2E75B6' }}
                onClick={() => { setShowSessionManager(true); setSessionPickerOpen(false) }}
              >
                Manage sessions…
              </div>
            </div>
          )}
        </div>

        {/* View toggle */}
        <button
          style={{ ...styles.btn, background: view === 'list' ? '#2E75B6' : '#eee', color: view === 'list' ? '#fff' : '#555' }}
          onClick={() => setView(view === 'canvas' ? 'list' : 'canvas')}
        >
          {view === 'canvas' ? '☰ List' : '⊞ Canvas'}
        </button>

        <button style={styles.btn} onClick={() => setShowCreateModal(true)}>+ Task</button>
        <button style={styles.btn} onClick={() => setShowImportExport(true)}>⬆⬇</button>
        <button style={styles.btn} onClick={() => setShowSettings(true)}>⚙</button>
      </div>
    </div>
  )
}

function pill(color, bg) {
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    color,
    background: bg,
    letterSpacing: 0.2,
  }
}

const styles = {
  toolbar: {
    height: 52, background: '#1E3A5F', display: 'flex', alignItems: 'center',
    padding: '0 16px', gap: 16, flexShrink: 0, userSelect: 'none',
  },
  logo: {
    color: '#fff', fontWeight: 900, fontSize: 20, letterSpacing: 3,
    fontFamily: '-apple-system, Arial, sans-serif',
  },
  centre: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' },
  counters: { display: 'flex', alignItems: 'center', gap: 6 },
  sessionName: {
    color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    padding: '4px 8px', borderRadius: 6,
  },
  nameInput: {
    background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.4)',
    borderRadius: 6, padding: '4px 8px', color: '#fff', fontSize: 14,
    outline: 'none', fontFamily: 'inherit', width: 180,
  },
  pauseBtn: {
    padding: '5px 12px', borderRadius: 8, border: 'none',
    cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
    transition: 'background 0.2s',
  },
  right: { display: 'flex', alignItems: 'center', gap: 6 },
  btn: {
    padding: '5px 12px', borderRadius: 8, border: 'none', background: '#eee',
    cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
    color: '#555',
  },
  picker: {
    position: 'absolute', top: '110%', right: 0, background: '#fff',
    border: '1px solid #ddd', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
    minWidth: 200, zIndex: 200, overflow: 'hidden',
  },
  pickerItem: {
    padding: '10px 16px', fontSize: 13, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  activePip: { width: 8, height: 8, borderRadius: '50%', background: '#2E75B6' },
  pickerDivider: { borderTop: '1px solid #eee' },
}
