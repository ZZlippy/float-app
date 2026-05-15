import { useState, useRef } from 'react'
import useStore from '../store/useStore'
import { DEFAULT_CARD_COLORS, DEFAULT_CANVAS_BG, DEFAULT_GROWTH_SPEED } from '../store/useStore'

const PRIORITY_TYPES = [
  { key: 'default',   label: 'Default',   desc: 'No flags set' },
  { key: 'important', label: 'Important', desc: '★ Important only' },
  { key: 'urgent',    label: 'Urgent',    desc: '⚡ Urgent only' },
  { key: 'critical',  label: 'Critical',  desc: '★ + ⚡ Both flags' },
]

const SPEED_OPTIONS = [
  { value: 'fast',   label: 'Fast',   desc: 'Max size in ~12 hours' },
  { value: 'medium', label: 'Medium', desc: 'Max size in ~3 days' },
  { value: 'slow',   label: 'Slow',   desc: 'Max size in ~5 days' },
]

export default function SettingsPanel({ onClose }) {
  const cardColors   = useStore(s => s.cardColors)
  const canvasBg     = useStore(s => s.canvasBg)
  const growthSpeed  = useStore(s => s.growthSpeed)
  const setCardColors    = useStore(s => s.setCardColors)
  const setCanvasBg      = useStore(s => s.setCanvasBg)
  const setGrowthSpeed   = useStore(s => s.setGrowthSpeed)
  const canvasBgImage    = useStore(s => s.canvasBgImage)
  const setCanvasBgImage = useStore(s => s.setCanvasBgImage)
  const panelOpacity     = useStore(s => s.panelOpacity)
  const setPanelOpacity  = useStore(s => s.setPanelOpacity)
  const soundVolume      = useStore(s => s.soundVolume)
  const setSoundVolume   = useStore(s => s.setSoundVolume)

  const imgInputRef = useRef(null)

  // Local draft — applied live on change
  const [localColors, setLocalColors]   = useState(() => JSON.parse(JSON.stringify(cardColors || DEFAULT_CARD_COLORS)))
  const [localBg, setLocalBg]           = useState(canvasBg || DEFAULT_CANVAS_BG)
  const [localSpeed, setLocalSpeed]     = useState(growthSpeed || DEFAULT_GROWTH_SPEED)
  const [expandedType, setExpandedType] = useState(null)

  function updateColor(type, field, value) {
    const next = { ...localColors, [type]: { ...localColors[type], [field]: value } }
    setLocalColors(next)
    setCardColors(next)       // live preview
  }

  function handleBgChange(value) {
    setLocalBg(value)
    setCanvasBg(value)        // live preview
  }

  function handleSpeedChange(value) {
    setLocalSpeed(value)
    setGrowthSpeed(value)     // live preview
  }

  function handleResetColors() {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_CARD_COLORS))
    setLocalColors(fresh)
    setCardColors(fresh)
  }

  function handleImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setCanvasBgImage(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''   // reset so same file can be re-selected
  }

  function handleRemoveImage() {
    setCanvasBgImage(null)
  }

  function handleResetAll() {
    handleResetColors()
    setLocalBg(DEFAULT_CANVAS_BG);       setCanvasBg(DEFAULT_CANVAS_BG)
    setLocalSpeed(DEFAULT_GROWTH_SPEED); setGrowthSpeed(DEFAULT_GROWTH_SPEED)
    setCanvasBgImage(null)
    setPanelOpacity(0.95)
    setSoundVolume(0.5)
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>

        {/* Header */}
        <div style={styles.header}>
          <h3 style={styles.title}>Settings</h3>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.scrollBody}>

          {/* ── Growth speed ─────────────────────────────────────────────── */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Card Growth Speed</div>
            <div style={styles.sectionDesc}>How quickly floating cards grow larger over time.</div>
            <div style={styles.speedRow}>
              {SPEED_OPTIONS.map(opt => (
                <label key={opt.value} style={{ ...styles.speedOption, outline: localSpeed === opt.value ? '2px solid #2E75B6' : '2px solid transparent' }}>
                  <input
                    type="radio"
                    name="speed"
                    value={opt.value}
                    checked={localSpeed === opt.value}
                    onChange={() => handleSpeedChange(opt.value)}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontWeight: 700, fontSize: 14, color: localSpeed === opt.value ? '#2E75B6' : '#333' }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{opt.desc}</div>
                </label>
              ))}
            </div>
          </div>

          <div style={styles.divider} />

          {/* ── Canvas background ─────────────────────────────────────────── */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Canvas Background</div>

            {/* Solid colour row */}
            <div style={styles.colorRow}>
              <span style={styles.colorLabel}>Colour</span>
              <input
                type="color"
                value={localBg}
                onChange={e => handleBgChange(e.target.value)}
                style={styles.colorSwatch}
                title="Canvas background colour"
              />
              <span style={styles.colorHex}>{localBg}</span>
              <button style={styles.btnXs} onClick={() => handleBgChange(DEFAULT_CANVAS_BG)}>Reset</button>
            </div>

            {/* Image upload row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={styles.colorLabel}>Image</span>
              <button style={styles.btnXs} onClick={() => imgInputRef.current?.click()}>
                Upload image
              </button>
              <input
                ref={imgInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              {canvasBgImage && (
                <>
                  <img
                    src={canvasBgImage}
                    alt="bg preview"
                    style={{ height: 36, width: 56, objectFit: 'cover', borderRadius: 6, border: '1.5px solid #ddd' }}
                  />
                  <button style={{ ...styles.btnXs, color: '#c00', borderColor: '#e88' }} onClick={handleRemoveImage}>
                    Remove
                  </button>
                </>
              )}
              {canvasBgImage && (
                <span style={{ fontSize: 11, color: '#888' }}>Image overrides colour</span>
              )}
            </div>

            {/* Panel opacity slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={styles.colorLabel}>Panel opacity</span>
              <input
                type="range"
                min={0} max={1} step={0.01}
                value={panelOpacity ?? 0.95}
                onChange={e => setPanelOpacity(Number(e.target.value))}
                style={{ flex: 1, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, color: '#888', width: 34, textAlign: 'right', fontFamily: 'monospace' }}>
                {Math.round((panelOpacity ?? 0.95) * 100)}%
              </span>
            </div>
          </div>

          <div style={styles.divider} />

          {/* ── Sound ────────────────────────────────────────────────────── */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Bounce Sound</div>
            <div style={styles.sectionDesc}>Volume for bounce sounds when cards hit the canvas edges.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={styles.colorLabel}>Volume</span>
              <input
                type="range"
                min={0} max={1} step={0.01}
                value={soundVolume ?? 0.5}
                onChange={e => setSoundVolume(Number(e.target.value))}
                style={{ flex: 1, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, color: '#888', width: 34, textAlign: 'right', fontFamily: 'monospace' }}>
                {soundVolume <= 0 ? 'Off' : `${Math.round((soundVolume ?? 0.5) * 100)}%`}
              </span>
            </div>
          </div>

          <div style={styles.divider} />

          {/* ── Card colours ──────────────────────────────────────────────── */}
          <div style={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={styles.sectionTitle}>Card Colours</div>
              <button style={styles.btnXs} onClick={handleResetColors}>Reset all</button>
            </div>
            <div style={styles.sectionDesc}>Customise background, text, and border per priority type.</div>

            {PRIORITY_TYPES.map(({ key, label, desc }) => {
              const col     = localColors[key] || DEFAULT_CARD_COLORS[key]
              const open    = expandedType === key
              const preview = (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: col.bg, border: `2px solid ${col.border}`,
                  borderRadius: 8, padding: '3px 10px',
                  color: col.text, fontSize: 12, fontWeight: 600,
                }}>
                  {label}
                </div>
              )

              return (
                <div key={key} style={styles.priorityCard}>
                  <div
                    style={styles.priorityHeader}
                    onClick={() => setExpandedType(open ? null : key)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {preview}
                      <span style={{ fontSize: 12, color: '#888' }}>{desc}</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#aaa' }}>{open ? '▲' : '▼'}</span>
                  </div>

                  {open && (
                    <div style={styles.priorityBody}>
                      {[
                        { field: 'bg',     fieldLabel: 'Background' },
                        { field: 'text',   fieldLabel: 'Text' },
                        { field: 'border', fieldLabel: 'Border' },
                      ].map(({ field, fieldLabel }) => (
                        <div key={field} style={styles.colorRow}>
                          <span style={styles.colorLabel}>{fieldLabel}</span>
                          <input
                            type="color"
                            value={col[field]}
                            onChange={e => updateColor(key, field, e.target.value)}
                            style={styles.colorSwatch}
                          />
                          <span style={styles.colorHex}>{col[field]}</span>
                          <button
                            style={styles.btnXs}
                            onClick={() => updateColor(key, field, DEFAULT_CARD_COLORS[key][field])}
                          >
                            Reset
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.btnOutline} onClick={handleResetAll}>Reset everything</button>
          <button style={styles.btnPrimary} onClick={onClose}>Done</button>
        </div>

      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: '#fff', borderRadius: 14, width: 480, maxHeight: '88vh',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    display: 'flex', flexDirection: 'column',
    fontFamily: '-apple-system, Arial, sans-serif',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 22px 14px', borderBottom: '1px solid #eee', flexShrink: 0,
  },
  title:    { margin: 0, fontSize: 18, fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', fontSize: 17, cursor: 'pointer', color: '#888' },
  scrollBody: { flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 4 },
  footer: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 22px', borderTop: '1px solid #eee', flexShrink: 0,
  },
  section:     { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#333', letterSpacing: 0.3, textTransform: 'uppercase' },
  sectionDesc:  { fontSize: 12, color: '#888', marginTop: -4 },
  divider:     { borderTop: '1px solid #f0f0f0', margin: '8px 0' },

  speedRow: { display: 'flex', gap: 10 },
  speedOption: {
    flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
    background: '#f8f8f8', transition: 'outline 0.15s',
  },

  colorRow:  { display: 'flex', alignItems: 'center', gap: 10 },
  colorLabel: { fontSize: 13, color: '#555', width: 76, flexShrink: 0 },
  colorSwatch: { width: 36, height: 28, border: '1.5px solid #ccc', borderRadius: 6, cursor: 'pointer', padding: 0 },
  colorHex:   { fontSize: 12, color: '#888', fontFamily: 'monospace', width: 64 },

  priorityCard: {
    border: '1px solid #eee', borderRadius: 10, overflow: 'hidden',
  },
  priorityHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px', cursor: 'pointer', background: '#fafafa',
    transition: 'background 0.1s',
  },
  priorityBody: {
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10,
    borderTop: '1px solid #eee', background: '#fff',
  },

  btnXs: {
    fontSize: 11, padding: '3px 8px', borderRadius: 5,
    border: '1px solid #ddd', background: '#fff', cursor: 'pointer',
    fontFamily: 'inherit', color: '#666',
  },
  btnOutline: {
    padding: '8px 18px', borderRadius: 8, border: '1.5px solid #ccc',
    background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
  },
  btnPrimary: {
    padding: '8px 22px', borderRadius: 8, border: 'none',
    background: '#2E75B6', color: '#fff', cursor: 'pointer',
    fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
  },
}
