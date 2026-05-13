import { useState } from 'react'
import useStore from '../store/useStore'
import { DEFAULT_CARD_COLORS } from '../store/useStore'

function getPriorityType(important, urgent) {
  if (important && urgent) return 'critical'
  if (important) return 'important'
  if (urgent) return 'urgent'
  return 'default'
}

export default function TaskEditModal({ task, onClose }) {
  const updateTask = useStore(s => s.updateTask)
  const cardColors = useStore(s => s.cardColors)

  const [text, setText]           = useState(task.text)
  const [important, setImportant] = useState(task.important)
  const [urgent, setUrgent]       = useState(task.urgent)
  const [colorOverride, setColorOverride] = useState(task.colorOverride || null)
  const [colorOpen, setColorOpen] = useState(false)

  // Effective colours for the preview and pickers
  const prioType     = getPriorityType(important, urgent)
  const globalColors = (cardColors || DEFAULT_CARD_COLORS)[prioType]
  const displayColors = colorOverride || globalColors

  function updateColor(field, value) {
    setColorOverride(prev => ({ ...(prev || globalColors), [field]: value }))
  }

  function resetColors() {
    setColorOverride(null)
  }

  function handleDone() {
    const trimmed = text.trim()
    updateTask(task.id, {
      text:          trimmed || task.text,
      important,
      urgent,
      colorOverride,
    })
    onClose()
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal} onKeyDown={handleKeyDown}>

        {/* Header */}
        <div style={s.header}>
          <span style={s.title}>Edit Task</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Text */}
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          style={s.textarea}
          rows={3}
          placeholder="Task description…"
        />

        {/* Flags */}
        <div style={s.flagRow}>
          <button
            style={{ ...s.flagBtn, ...(important ? s.flagActive('#2E75B6') : {}) }}
            onClick={() => setImportant(v => !v)}
          >
            ★ Important
          </button>
          <button
            style={{ ...s.flagBtn, ...(urgent ? s.flagActive('#e07b00') : {}) }}
            onClick={() => setUrgent(v => !v)}
          >
            ⚡ Urgent
          </button>
        </div>

        {/* Preview */}
        <div style={s.previewWrap}>
          <span style={s.previewLabel}>Preview</span>
          <div style={{
            background: displayColors.bg,
            color: displayColors.text,
            border: `2px solid ${displayColors.border}`,
            borderRadius: 10, padding: '10px 14px',
            fontSize: 14, fontWeight: 500,
            maxWidth: '100%', wordBreak: 'break-word',
          }}>
            {important && '★ '}{urgent && '⚡ '}{text || '(empty)'}
          </div>
        </div>

        {/* Custom colour section */}
        <div style={s.colorSection}>
          <button style={s.colorToggle} onClick={() => setColorOpen(v => !v)}>
            <span>Custom Colour {colorOverride ? '●' : ''}</span>
            <span>{colorOpen ? '▲' : '▼'}</span>
          </button>

          {colorOpen && (
            <div style={s.colorBody}>
              {[
                { field: 'bg',     label: 'Background' },
                { field: 'text',   label: 'Text' },
                { field: 'border', label: 'Border' },
              ].map(({ field, label }) => (
                <div key={field} style={s.colorRow}>
                  <span style={s.colorLabel}>{label}</span>
                  <input
                    type="color"
                    value={displayColors[field]}
                    onChange={e => updateColor(field, e.target.value)}
                    style={s.swatch}
                  />
                  <span style={s.colorHex}>{displayColors[field]}</span>
                </div>
              ))}
              <button
                style={{ ...s.resetBtn, opacity: colorOverride ? 1 : 0.4 }}
                onClick={resetColors}
                disabled={!colorOverride}
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={s.doneBtn} onClick={handleDone}>Done</button>
        </div>

      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, fontFamily: '-apple-system, Arial, sans-serif',
  },
  modal: {
    background: '#fff', borderRadius: 14, width: 400,
    boxShadow: '0 10px 40px rgba(0,0,0,0.22)',
    display: 'flex', flexDirection: 'column', gap: 14, padding: 22,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title:  { fontSize: 16, fontWeight: 700, color: '#222' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 16,
    cursor: 'pointer', color: '#888', lineHeight: 1,
  },
  textarea: {
    width: '100%', border: '1.5px solid #ddd', borderRadius: 8,
    padding: '9px 12px', fontSize: 14, fontFamily: 'inherit',
    resize: 'vertical', outline: 'none', boxSizing: 'border-box',
    lineHeight: 1.5,
  },
  flagRow: { display: 'flex', gap: 10 },
  flagBtn: {
    flex: 1, padding: '8px 12px', borderRadius: 8,
    border: '1.5px solid #ddd', background: '#f5f5f5',
    cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
    fontWeight: 600, color: '#666', transition: 'all 0.15s',
  },
  flagActive: (color) => ({
    background: color + '22', borderColor: color, color,
  }),
  previewWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  previewLabel: { fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 },
  colorSection: {
    border: '1px solid #eee', borderRadius: 10, overflow: 'hidden',
  },
  colorToggle: {
    width: '100%', background: '#fafafa', border: 'none',
    padding: '10px 14px', cursor: 'pointer', fontSize: 13,
    fontFamily: 'inherit', fontWeight: 600, color: '#444',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  colorBody: {
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10,
    borderTop: '1px solid #eee',
  },
  colorRow:  { display: 'flex', alignItems: 'center', gap: 10 },
  colorLabel: { fontSize: 13, color: '#555', width: 80, flexShrink: 0 },
  swatch: {
    width: 34, height: 26, border: '1.5px solid #ccc',
    borderRadius: 6, cursor: 'pointer', padding: 0,
  },
  colorHex: { fontSize: 12, color: '#888', fontFamily: 'monospace' },
  resetBtn: {
    alignSelf: 'flex-start', fontSize: 12, padding: '4px 10px',
    borderRadius: 6, border: '1px solid #ddd', background: '#fff',
    cursor: 'pointer', fontFamily: 'inherit', color: '#666',
  },
  footer:    { display: 'flex', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: {
    padding: '8px 18px', borderRadius: 8, border: '1.5px solid #ccc',
    background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
  },
  doneBtn: {
    padding: '8px 22px', borderRadius: 8, border: 'none',
    background: '#2E75B6', color: '#fff', cursor: 'pointer',
    fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
  },
}
