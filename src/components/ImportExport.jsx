import { useRef, useState } from 'react'
import Papa from 'papaparse'
import useStore, { findDuplicate } from '../store/useStore'

export default function ImportExport({ onClose }) {
  const tasks = useStore(s => s.tasks)
  const sessions = useStore(s => s.sessions)
  const activeSessionId = useStore(s => s.activeSessionId)
  const importTasks = useStore(s => s.importTasks)

  const fileRef = useRef(null)
  const [importResult, setImportResult] = useState(null)

  const session = sessions.find(s => s.id === activeSessionId)
  const sessionName = (session?.name || 'session').replace(/\s+/g, '-').toLowerCase()

  function handleDownloadTemplate() {
    const csv = Papa.unparse([
      { text: 'Example task — replace with your own', important: false, urgent: false },
      { text: 'Urgent example task', important: false, urgent: true },
      { text: 'Important example task', important: true, urgent: false },
    ])
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'float-task-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExport() {
    const rows = tasks.map(t => ({
      id: t.id,
      text: t.text,
      status: t.status,
      important: t.important,
      urgent: t.urgent,
      created_at: new Date(t.createdAt).toISOString(),
      updated_at: new Date(t.updatedAt).toISOString(),
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `float-${sessionName}-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const valid = []
        const skipped = []
        const duplicates = []

        for (const row of result.data) {
          if (!row.text || !row.text.trim()) { skipped.push(row); continue }
          const dup = findDuplicate(row.text, tasks)
          if (dup) { duplicates.push({ row, dup }); continue }
          valid.push(row)
        }

        setImportResult({ valid, skipped, duplicates, pendingDups: duplicates })
      },
    })
  }

  async function confirmImport(includeDups) {
    const { valid, pendingDups } = importResult
    const toImport = includeDups ? [...valid, ...pendingDups.map(d => d.row)] : valid
    if (toImport.length > 0) await importTasks(toImport)
    setImportResult(null)
    fileRef.current.value = ''
    onClose()
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>Import / Export</h3>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Export */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Export</div>
          <p style={styles.desc}>Download all tasks in this session as a CSV file.</p>
          <button style={styles.btnPrimary} onClick={handleExport}>
            ⬇ Export as CSV ({tasks.length} tasks)
          </button>
        </div>

        <hr style={styles.divider} />

        {/* Import */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Import</div>
          <p style={styles.desc}>Upload a CSV file. Tasks are added to the current session as "Not Started".</p>
          <button style={{ ...styles.btnOutline, marginBottom: 8, alignSelf: 'flex-start' }} onClick={handleDownloadTemplate}>
            ⬇ Download template CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} style={{ fontSize: 13 }} />
        </div>

        {/* Import result */}
        {importResult && (
          <div style={styles.resultBox}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <strong>{importResult.valid.length}</strong> task(s) ready to import.
              {importResult.skipped.length > 0 && <span style={{ color: '#999' }}> {importResult.skipped.length} skipped (missing text).</span>}
              {importResult.duplicates.length > 0 && (
                <span style={{ color: '#e07b00' }}> {importResult.duplicates.length} possible duplicate(s) found.</span>
              )}
            </div>
            {importResult.duplicates.length > 0 && (
              <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
                Duplicates: {importResult.duplicates.map(d => `"${d.row.text}"`).join(', ')}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={styles.btnPrimary} onClick={() => confirmImport(false)}>
                Import {importResult.valid.length} (skip duplicates)
              </button>
              {importResult.duplicates.length > 0 && (
                <button style={styles.btnOutline} onClick={() => confirmImport(true)}>
                  Import all {importResult.valid.length + importResult.duplicates.length}
                </button>
              )}
              <button style={styles.btnOutline} onClick={() => { setImportResult(null); fileRef.current.value = '' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
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
    background: '#fff', borderRadius: 12, padding: 24, width: 420,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 16,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#888' },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#333' },
  desc: { margin: 0, fontSize: 13, color: '#666' },
  divider: { border: 'none', borderTop: '1px solid #eee', margin: 0 },
  resultBox: {
    background: '#f8f9ff', border: '1px solid #dde', borderRadius: 8,
    padding: '12px 14px',
  },
  btnPrimary: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: '#2E75B6', color: '#fff', cursor: 'pointer',
    fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
  },
  btnOutline: {
    padding: '8px 16px', borderRadius: 8, border: '1.5px solid #ccc',
    background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
  },
}
