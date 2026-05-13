import { useState } from 'react'
import useStore from '../store/useStore'

export default function SessionManager({ onClose }) {
  const sessions = useStore(s => s.sessions)
  const activeSessionId = useStore(s => s.activeSessionId)
  const createSession = useStore(s => s.createSession)
  const switchSession = useStore(s => s.switchSession)
  const renameSession = useStore(s => s.renameSession)
  const deleteSession = useStore(s => s.deleteSession)

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  function startRename(s) {
    setEditingId(s.id)
    setEditName(s.name)
  }

  function commitRename(id) {
    if (editName.trim()) renameSession(id, editName.trim())
    setEditingId(null)
  }

  async function handleDelete(id) {
    await deleteSession(id)
    setConfirmDelete(null)
    if (sessions.length <= 1) onClose()
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>Sessions</h3>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.list}>
          {sessions.map(s => (
            <div key={s.id} style={{ ...styles.row, background: s.id === activeSessionId ? '#eef4ff' : '#fff' }}>
              {editingId === s.id
                ? <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => commitRename(s.id)}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setEditingId(null) }}
                    style={styles.nameInput}
                  />
                : <span
                    style={{ ...styles.name, fontWeight: s.id === activeSessionId ? 700 : 400 }}
                    onClick={() => { switchSession(s.id); onClose() }}
                  >
                    {s.name}
                    {s.id === activeSessionId && <span style={styles.activeBadge}>active</span>}
                    {s.paused && <span style={styles.pausedBadge}>paused</span>}
                  </span>
              }

              <div style={styles.rowActions}>
                <button style={styles.iconBtn} title="Rename" onClick={() => startRename(s)}>✏️</button>
                {sessions.length > 1 && (
                  <button style={styles.iconBtn} title="Delete" onClick={() => setConfirmDelete(s.id)}>🗑</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {confirmDelete && (
          <div style={styles.confirmBox}>
            <span style={{ fontSize: 13 }}>Delete "{sessions.find(s => s.id === confirmDelete)?.name}"? All its tasks will be removed.</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button style={styles.btnDanger} onClick={() => handleDelete(confirmDelete)}>Delete</button>
              <button style={styles.btnOutline} onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
          </div>
        )}

        <button style={styles.btnNew} onClick={() => { createSession(); onClose() }}>
          + New Session
        </button>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: '#fff', borderRadius: 12, padding: 24, width: 380,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 12,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#888' },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 8, border: '1px solid #eee',
  },
  name: {
    flex: 1, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
  },
  nameInput: {
    flex: 1, border: '1.5px solid #2E75B6', borderRadius: 6,
    padding: '4px 8px', fontSize: 14, outline: 'none', fontFamily: 'inherit',
  },
  rowActions: { display: 'flex', gap: 4 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4 },
  activeBadge: {
    fontSize: 10, background: '#2E75B6', color: '#fff',
    borderRadius: 6, padding: '1px 6px', fontWeight: 600,
  },
  pausedBadge: {
    fontSize: 10, background: '#e07b00', color: '#fff',
    borderRadius: 6, padding: '1px 6px', fontWeight: 600,
  },
  confirmBox: {
    background: '#fff5f5', border: '1px solid #f5c6c6',
    borderRadius: 8, padding: '12px 14px',
  },
  btnDanger: {
    padding: '7px 16px', borderRadius: 8, border: 'none',
    background: '#e05252', color: '#fff', cursor: 'pointer',
    fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
  },
  btnOutline: {
    padding: '7px 16px', borderRadius: 8, border: '1.5px solid #ccc',
    background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
  },
  btnNew: {
    padding: '10px', borderRadius: 8, border: '1.5px dashed #2E75B6',
    background: '#f0f6ff', color: '#2E75B6', cursor: 'pointer',
    fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
  },
}
