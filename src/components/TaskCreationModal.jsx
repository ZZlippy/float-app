import { useState, useEffect, useRef } from 'react'
import useStore, { findDuplicate } from '../store/useStore'

export default function TaskCreationModal({ onClose }) {
  const [text, setText] = useState('')
  const [important, setImportant] = useState(false)
  const [urgent, setUrgent] = useState(false)
  const [dupWarning, setDupWarning] = useState(null)
  const [pendingSubmit, setPendingSubmit] = useState(false)
  const inputRef = useRef(null)
  const tasks = useStore(s => s.tasks)
  const addTask = useStore(s => s.addTask)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleTextChange(e) {
    setText(e.target.value)
    setDupWarning(null)
    setPendingSubmit(false)
  }

  async function handleSubmit(force = false) {
    const trimmed = text.trim()
    if (!trimmed) return

    if (!force) {
      const dup = findDuplicate(trimmed, tasks)
      if (dup) {
        setDupWarning(dup.text)
        setPendingSubmit(true)
        return
      }
    }

    await addTask(trimmed, important, urgent)
    onClose()
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleSubmit(false)
    if (e.key === 'Escape') onClose()
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <h3 style={styles.title}>New Task</h3>

        <input
          ref={inputRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKey}
          placeholder="What needs to be done?"
          style={styles.input}
        />

        {dupWarning && (
          <div style={styles.dupWarning}>
            <span>⚠️ Similar task exists: <em>"{dupWarning}"</em></span>
            <div style={styles.dupActions}>
              <button style={styles.btnSmallOutline} onClick={() => { setDupWarning(null); setPendingSubmit(false) }}>Cancel</button>
              <button style={styles.btnSmallPrimary} onClick={() => handleSubmit(true)}>Add Anyway</button>
            </div>
          </div>
        )}

        <div style={styles.toggleRow}>
          <Toggle label="★ Important" color="#2E75B6" value={important} onChange={setImportant} />
          <Toggle label="⚡ Urgent" color="#e07b00" value={urgent} onChange={setUrgent} />
        </div>

        <div style={styles.actions}>
          <button style={styles.btnOutline} onClick={onClose}>Cancel</button>
          <button style={styles.btnPrimary} onClick={() => handleSubmit(pendingSubmit)}>Add Task</button>
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, color, value, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 36, height: 20, borderRadius: 10,
          background: value ? color : '#ccc',
          position: 'relative', transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: value ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
      <span style={{ fontSize: 13, color: value ? color : '#666' }}>{label}</span>
    </label>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: '#fff', borderRadius: 12, padding: 24, width: 360,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 16,
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a1a' },
  input: {
    border: '1.5px solid #ddd', borderRadius: 8, padding: '10px 12px',
    fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  toggleRow: { display: 'flex', gap: 24 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
  btnOutline: {
    padding: '8px 18px', borderRadius: 8, border: '1.5px solid #ccc',
    background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
  },
  btnPrimary: {
    padding: '8px 18px', borderRadius: 8, border: 'none',
    background: '#2E75B6', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
    fontWeight: 600,
  },
  dupWarning: {
    background: '#fff8e6', border: '1px solid #ffd080', borderRadius: 8,
    padding: '10px 12px', fontSize: 13, color: '#7a4f00', display: 'flex',
    flexDirection: 'column', gap: 10,
  },
  dupActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  btnSmallOutline: {
    padding: '5px 12px', borderRadius: 6, border: '1px solid #bbb',
    background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
  },
  btnSmallPrimary: {
    padding: '5px 12px', borderRadius: 6, border: 'none',
    background: '#e07b00', color: '#fff', cursor: 'pointer', fontSize: 12,
    fontFamily: 'inherit', fontWeight: 600,
  },
}
