import { useState } from 'react'
import useStore from '../store/useStore'

const STATUS_ORDER = ['not_started', 'working', 'finished', 'discarded']
const STATUS_LABEL = {
  not_started: 'Not Started',
  working:     'Working On It',
  finished:    'Finished',
  discarded:   'Discarded',
}
const STATUS_COLOR = {
  not_started: '#2E75B6',
  working:     '#e07b00',
  finished:    '#2a9d5c',
  discarded:   '#999',
}

function timeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60)  return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60)  return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)   return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

function formatDuration(ms) {
  const min = Math.floor(ms / 60000)
  if (min < 60)  return `${min}m`
  const hr = Math.floor(min / 60)
  const remMin = min % 60
  if (hr < 24)   return remMin > 0 ? `${hr}h ${remMin}m` : `${hr}h`
  const days = Math.floor(hr / 24)
  const remHr = hr % 24
  return remHr > 0 ? `${days}d ${remHr}h` : `${days}d`
}

export default function ListView() {
  const tasks           = useStore(s => s.tasks)
  const updateTask      = useStore(s => s.updateTask)
  const bulkUpdateTasks = useStore(s => s.bulkUpdateTasks)
  const bulkDeleteTasks = useStore(s => s.bulkDeleteTasks)
  const addTask         = useStore(s => s.addTask)

  const [selected, setSelected]           = useState(new Set())
  const [editingId, setEditingId]         = useState(null)
  const [editText, setEditText]           = useState('')
  const [newTaskText, setNewTaskText]     = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  function toggleSelect(id) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  function toggleGroupSelect(groupTasks) {
    const groupIds  = groupTasks.map(t => t.id)
    const allChosen = groupIds.every(id => selected.has(id))
    const next = new Set(selected)
    if (allChosen) { groupIds.forEach(id => next.delete(id)) }
    else           { groupIds.forEach(id => next.add(id)) }
    setSelected(next)
  }

  function handleBulkStatus(status) {
    const patch = { status }
    if (status === 'finished') patch.finishedAt = Date.now()
    else                       patch.finishedAt = null
    bulkUpdateTasks([...selected], patch)
    setSelected(new Set())
  }

  function handleBulkToggle(flag) {
    const anyTrue = [...selected].some(id => {
      const t = tasks.find(t => t.id === id)
      return t && t[flag]
    })
    bulkUpdateTasks([...selected], { [flag]: !anyTrue })
  }

  async function handleBulkDelete() {
    await bulkDeleteTasks([...selected])
    setSelected(new Set())
    setConfirmDelete(false)
  }

  function startEdit(task) { setEditingId(task.id); setEditText(task.text) }

  function commitEdit(task) {
    if (editText.trim()) updateTask(task.id, { text: editText.trim() })
    setEditingId(null)
  }

  async function handleAddTask(e) {
    e.preventDefault()
    if (!newTaskText.trim()) return
    await addTask(newTaskText.trim(), false, false)
    setNewTaskText('')
  }

  const grouped = STATUS_ORDER.map(status => ({
    status,
    tasks: tasks.filter(t => t.status === status),
  }))

  return (
    <div style={styles.container}>

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <div style={styles.stickyHeader}>
        {selected.size > 0 && (
          <div style={styles.bulkBar}>
            <span style={{ fontSize: 14, color: '#555' }}>{selected.size} selected</span>
            <div style={styles.bulkActions}>
              <select
                style={styles.select}
                onChange={e => { if (e.target.value) handleBulkStatus(e.target.value); e.target.value = '' }}
                defaultValue=""
              >
                <option value="" disabled>Change status…</option>
                {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <button style={styles.btnSm} onClick={() => handleBulkToggle('important')}>Toggle ★ Important</button>
              <button style={styles.btnSm} onClick={() => handleBulkToggle('urgent')}>Toggle ⚡ Urgent</button>
              <button style={{ ...styles.btnSm, color: '#c00', borderColor: '#e88' }} onClick={() => setConfirmDelete(true)}>Delete</button>
            </div>
          </div>
        )}

        {confirmDelete && (
          <div style={styles.confirmBar}>
            <span style={{ fontSize: 14 }}>Permanently delete {selected.size} task(s)?</span>
            <button style={{ ...styles.btnSm, background: '#e05252', color: '#fff', borderColor: '#e05252' }} onClick={handleBulkDelete}>Yes, delete</button>
            <button style={styles.btnSm} onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        )}

        <form onSubmit={handleAddTask} style={styles.addRow}>
          <input
            value={newTaskText}
            onChange={e => setNewTaskText(e.target.value)}
            placeholder="Add a task…"
            style={styles.addInput}
          />
          <button type="submit" style={styles.btnPrimary}>+ Add</button>
        </form>
      </div>

      {/* ── Groups ─────────────────────────────────────────────────────────── */}
      {grouped.map(({ status, tasks: groupTasks }) => {
        const groupIds     = groupTasks.map(t => t.id)
        const allSelected  = groupIds.length > 0 && groupIds.every(id => selected.has(id))
        const someSelected = groupIds.some(id => selected.has(id))

        return (
          <div key={status} style={styles.group}>
            <div style={styles.groupHeader}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                onChange={() => toggleGroupSelect(groupTasks)}
                disabled={groupTasks.length === 0}
                title={`Select all in ${STATUS_LABEL[status]}`}
                style={{ cursor: groupTasks.length > 0 ? 'pointer' : 'default' }}
              />
              <span style={{ ...styles.groupDot, background: STATUS_COLOR[status] }} />
              <span style={{ fontWeight: 700, fontSize: 15, color: '#333' }}>{STATUS_LABEL[status]}</span>
              <span style={styles.groupCount}>{groupTasks.length}</span>
            </div>

            {groupTasks.length === 0
              ? <div style={styles.empty}>None</div>
              : groupTasks.map(task => {
                  const isFinished = task.status === 'finished' && task.finishedAt
                  const dateStr = isFinished
                    ? new Date(task.finishedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : new Date(task.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  const elapsedStr = isFinished
                    ? `took ${formatDuration(task.finishedAt - task.createdAt)}`
                    : timeAgo(task.createdAt)

                  return (
                    <div key={task.id} style={{ ...styles.row, background: selected.has(task.id) ? '#eef4ff' : '#fff' }}>
                      <input type="checkbox" checked={selected.has(task.id)} onChange={() => toggleSelect(task.id)} />

                      {editingId === task.id
                        ? <input
                            autoFocus
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            onBlur={() => commitEdit(task)}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit(task); if (e.key === 'Escape') setEditingId(null) }}
                            style={styles.editInput}
                          />
                        : <span style={styles.taskText} onClick={() => startEdit(task)}>
                            {task.important && <span style={{ color: '#2E75B6', marginRight: 4 }}>★</span>}
                            {task.urgent    && <span style={{ color: '#e07b00', marginRight: 4 }}>⚡</span>}
                            {task.text}
                          </span>
                      }

                      <div style={styles.rowMeta}>
                        <FlagToggle value={task.important} color="#2E75B6" label="★" onChange={v => updateTask(task.id, { important: v })} />
                        <FlagToggle value={task.urgent}    color="#e07b00" label="⚡" onChange={v => updateTask(task.id, { urgent:    v })} />
                        <span style={{ ...styles.statusBadge, background: STATUS_COLOR[status] + '22', color: STATUS_COLOR[status] }}>
                          {STATUS_LABEL[status]}
                        </span>
                        <span style={styles.date}>
                          {isFinished && <span style={styles.finishedLabel}>Finished: </span>}
                          {dateStr}
                          <span style={styles.elapsed}> · {elapsedStr}</span>
                        </span>
                        {task.status === 'discarded' && (
                          <button style={styles.restoreBtn} onClick={() => updateTask(task.id, { status: 'not_started', finishedAt: null })}>Restore</button>
                        )}
                        {task.status === 'finished' && (
                          <button style={styles.restoreBtn} onClick={() => updateTask(task.id, { status: 'not_started', finishedAt: null })}>Reopen</button>
                        )}
                      </div>
                    </div>
                  )
                })
            }
          </div>
        )
      })}
    </div>
  )
}

function FlagToggle({ value, color, label, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', fontSize: 15,
        opacity: value ? 1 : 0.25, padding: '0 2px',
        color: value ? color : '#aaa',
      }}
      title={label}
    >{label}</button>
  )
}

const styles = {
  container: {
    flex: 1, overflowY: 'auto', padding: '0',
    fontFamily: '-apple-system, Arial, sans-serif',
  },
  stickyHeader: {
    position: 'sticky', top: 0, zIndex: 10,
    background: '#fff',
    padding: '14px 28px 10px',
    borderBottom: '1px solid #eee',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  bulkBar: {
    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    background: '#f0f6ff', border: '1px solid #cde', borderRadius: 8,
    padding: '10px 14px', marginBottom: 10,
  },
  bulkActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  confirmBar: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#fff5f5', border: '1px solid #f5c6c6', borderRadius: 8,
    padding: '10px 14px', marginBottom: 10,
  },
  addRow:   { display: 'flex', gap: 8 },
  addInput: {
    flex: 1, border: '1.5px solid #ddd', borderRadius: 8,
    padding: '9px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit',
  },
  group:       { marginBottom: 22, padding: '0 28px' },
  groupHeader: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 4px 8px', borderBottom: '1.5px solid #eee', marginBottom: 6,
  },
  groupDot:   { width: 11, height: 11, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  groupCount: { fontSize: 12, background: '#eee', borderRadius: 10, padding: '1px 8px', color: '#666' },
  empty:      { fontSize: 13, color: '#bbb', padding: '6px 4px' },
  row: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
    borderRadius: 8, marginBottom: 4, border: '1px solid #f0f0f0',
  },
  taskText: {
    flex: 1, fontSize: 14, color: '#222', cursor: 'text',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  editInput: {
    flex: 1, border: '1.5px solid #2E75B6', borderRadius: 6,
    padding: '4px 8px', fontSize: 14, outline: 'none', fontFamily: 'inherit',
  },
  rowMeta:      { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  statusBadge:  { fontSize: 12, borderRadius: 6, padding: '2px 9px', fontWeight: 600, whiteSpace: 'nowrap' },
  date:         { fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' },
  finishedLabel:{ color: '#2a9d5c', fontWeight: 600 },
  elapsed:      { color: '#bbb' },
  restoreBtn:   {
    fontSize: 12, padding: '3px 9px', borderRadius: 6,
    border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontFamily: 'inherit',
  },
  btnSm: {
    fontSize: 13, padding: '5px 10px', borderRadius: 6,
    border: '1px solid #ccc', background: '#fff', cursor: 'pointer',
    fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  btnPrimary: {
    padding: '9px 18px', borderRadius: 8, border: 'none',
    background: '#2E75B6', color: '#fff', cursor: 'pointer',
    fontSize: 14, fontFamily: 'inherit', fontWeight: 600,
  },
  select: {
    fontSize: 13, padding: '5px 8px', borderRadius: 6,
    border: '1px solid #ccc', background: '#fff', fontFamily: 'inherit',
  },
}
