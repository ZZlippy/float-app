import { create } from 'zustand'
import {
  getAllSessions, saveSession, deleteSessionFromDB,
  getTasksForSession, saveTask, deleteTaskFromDB, saveTasksBatch,
  getSetting, setSetting,
} from '../db/db'

// ── Defaults ──────────────────────────────────────────────────────────────────

function newSession(name, index) {
  return {
    id: crypto.randomUUID(),
    name: name || `Session ${index}`,
    createdAt: Date.now(),
    paused: false,
    pausedAt: null,
    boardCap: 3,
  }
}

function newTask(sessionId, text, important, urgent) {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    sessionId,
    text,
    status: 'not_started',   // not_started | working | finished | discarded
    important: !!important,
    urgent: !!urgent,
    createdAt: now,
    updatedAt: now,
    lastTouchedAt: now,
    finishedAt: null,
    colorOverride: null,     // { bg, text, border } | null
    sortIndex: now,
    posX: Math.random() * 600 + 100,
    posY: Math.random() * 400 + 100,
    velX: (Math.random() - 0.5) * 2,
    velY: (Math.random() - 0.5) * 2,
  }
}

// ── Aging scale ───────────────────────────────────────────────────────────────

export const AGING_THRESHOLDS_BY_SPEED = {
  fast:   [0,  10,   80,   240,  720].map(m => m * 60 * 1000),  // max at ~12 hours
  medium: [0,  60,  480,  1440, 4320].map(m => m * 60 * 1000),  // max at ~3 days
  slow:   [0, 100,  800,  2400, 7200].map(m => m * 60 * 1000),  // max at ~5 days
}
const AGING_SCALES = [1.0, 1.4, 1.8, 2.4, 3.0]

export function getAgingScale(lastTouchedAt, nowMs, speed = 'medium') {
  const thresholds = AGING_THRESHOLDS_BY_SPEED[speed] || AGING_THRESHOLDS_BY_SPEED.medium
  const elapsed = nowMs - lastTouchedAt
  let tier = 0
  for (let i = 0; i < thresholds.length; i++) {
    if (elapsed >= thresholds[i]) tier = i
  }
  const nextTier = Math.min(tier + 1, AGING_SCALES.length - 1)
  if (tier === nextTier) return AGING_SCALES[tier]
  const tierStart = thresholds[tier]
  const tierEnd   = thresholds[nextTier] || thresholds[tier] * 3
  const t = Math.min((elapsed - tierStart) / (tierEnd - tierStart), 1)
  return AGING_SCALES[tier] + t * (AGING_SCALES[nextTier] - AGING_SCALES[tier])
}

// ── Card colour defaults ──────────────────────────────────────────────────────

export const DEFAULT_CARD_COLORS = {
  default:   { bg: '#f0f0f0', text: '#1a1a1a', border: '#cccccc' },
  important: { bg: '#A8C7F0', text: '#0d1f3c', border: '#5a8fd4' },
  urgent:    { bg: '#FFB347', text: '#2a1500', border: '#e07b00' },
  critical:  { bg: '#E05252', text: '#ffffff', border: '#a02020' },
}

export const DEFAULT_CANVAS_BG    = '#fafafa'
export const DEFAULT_GROWTH_SPEED = 'medium'

export const DEFAULT_SORTS = {
  board:       'custom',
  not_started: 'created',
  working:     'created',
  finished:    'created',
  discarded:   'created',
}

// ── Sort helper ───────────────────────────────────────────────────────────────
export function applySort(tasks, sortBy) {
  const arr = [...tasks]
  switch (sortBy) {
    case 'alpha':         return arr.sort((a, b) => a.text.localeCompare(b.text))
    case 'alpha_desc':    return arr.sort((a, b) => b.text.localeCompare(a.text))
    case 'created':       return arr.sort((a, b) => a.createdAt - b.createdAt)
    case 'created_desc':  return arr.sort((a, b) => b.createdAt - a.createdAt)
    case 'elapsed':       return arr.sort((a, b) => a.lastTouchedAt - b.lastTouchedAt)
    case 'elapsed_desc':  return arr.sort((a, b) => b.lastTouchedAt - a.lastTouchedAt)
    case 'custom':        return arr.sort((a, b) => (a.sortIndex ?? a.createdAt) - (b.sortIndex ?? b.createdAt))
    default:              return arr
  }
}

// ── Duplicate detection ───────────────────────────────────────────────────────

function normalise(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

export function findDuplicate(text, tasks) {
  const norm = normalise(text)
  for (const t of tasks) {
    const tn = normalise(t.text)
    if (tn === norm) return t
    const threshold = Math.max(2, Math.floor(norm.length * 0.2))
    if (levenshtein(norm, tn) <= threshold) return t
  }
  return null
}

// ── Store ─────────────────────────────────────────────────────────────────────

const useStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  sessions: [],
  activeSessionId: null,
  tasks: [],
  view: 'canvas',
  showCreateModal: false,
  showSessionManager: false,
  showSettings: false,
  showImportExport: false,
  loaded: false,

  // Appearance & behaviour settings
  cardColors:    DEFAULT_CARD_COLORS,
  canvasBg:      DEFAULT_CANVAS_BG,
  growthSpeed:   DEFAULT_GROWTH_SPEED,
  canvasBgImage: null,
  panelOpacity:  0.95,
  sorts:         DEFAULT_SORTS,
  soundVolume:   0.5,

  // ── Boot ───────────────────────────────────────────────────────────────────
  boot: async () => {
    let sessions = await getAllSessions()
    let activeId = await getSetting('activeSessionId')

    if (sessions.length === 0) {
      const s = newSession('Session 1', 1)
      await saveSession(s)
      sessions = [s]
    }

    if (!activeId || !sessions.find(s => s.id === activeId)) {
      activeId = sessions[0].id
      await setSetting('activeSessionId', activeId)
    }

    const tasks      = await getTasksForSession(activeId)
    const cardColors    = await getSetting('cardColors')    || DEFAULT_CARD_COLORS
    const canvasBg      = await getSetting('canvasBg')      || DEFAULT_CANVAS_BG
    const growthSpeed   = await getSetting('growthSpeed')   || DEFAULT_GROWTH_SPEED
    const canvasBgImage = await getSetting('canvasBgImage') || null
    const panelOpacity  = await getSetting('panelOpacity')  ?? 0.95
    const sorts         = await getSetting('sorts')         || DEFAULT_SORTS
    const soundVolume   = await getSetting('soundVolume')   ?? 0.5

    set({ sessions, activeSessionId: activeId, tasks, loaded: true, cardColors, canvasBg, growthSpeed, canvasBgImage, panelOpacity, sorts, soundVolume })
  },

  // ── Session actions ────────────────────────────────────────────────────────
  createSession: async () => {
    const { sessions } = get()
    const s = newSession(null, sessions.length + 1)
    await saveSession(s)
    await setSetting('activeSessionId', s.id)
    set({ sessions: [...sessions, s], activeSessionId: s.id, tasks: [] })
  },

  switchSession: async (id) => {
    const tasks = await getTasksForSession(id)
    await setSetting('activeSessionId', id)
    set({ activeSessionId: id, tasks })
  },

  renameSession: async (id, name) => {
    const { sessions } = get()
    const updated = sessions.map(s => s.id === id ? { ...s, name } : s)
    const session = updated.find(s => s.id === id)
    await saveSession(session)
    set({ sessions: updated })
  },

  deleteSession: async (id) => {
    const { sessions, activeSessionId } = get()
    await deleteSessionFromDB(id)
    const remaining = sessions.filter(s => s.id !== id)
    if (remaining.length === 0) {
      const s = newSession('Session 1', 1)
      await saveSession(s)
      remaining.push(s)
    }
    const newActive = activeSessionId === id ? remaining[0].id : activeSessionId
    const tasks = await getTasksForSession(newActive)
    await setSetting('activeSessionId', newActive)
    set({ sessions: remaining, activeSessionId: newActive, tasks })
  },

  togglePause: async () => {
    const { sessions, activeSessionId, tasks } = get()
    const session = sessions.find(s => s.id === activeSessionId)
    if (!session) return
    const now = Date.now()
    let updated

    if (session.paused) {
      const pausedDuration = now - (session.pausedAt || now)
      updated = { ...session, paused: false, pausedAt: null }
      const adjustedTasks = tasks.map(t =>
        t.status === 'not_started'
          ? { ...t, lastTouchedAt: t.lastTouchedAt + pausedDuration }
          : t
      )
      await saveTasksBatch(adjustedTasks)
      set({
        sessions: sessions.map(s => s.id === activeSessionId ? updated : s),
        tasks: adjustedTasks,
      })
    } else {
      updated = { ...session, paused: true, pausedAt: now }
      set({ sessions: sessions.map(s => s.id === activeSessionId ? updated : s) })
    }
    await saveSession(updated)
  },

  updateSessionBoardCap: async (cap) => {
    const { sessions, activeSessionId } = get()
    const updated = sessions.map(s =>
      s.id === activeSessionId ? { ...s, boardCap: cap } : s
    )
    const session = updated.find(s => s.id === activeSessionId)
    await saveSession(session)
    set({ sessions: updated })
  },

  // ── Task actions ───────────────────────────────────────────────────────────
  addTask: async (text, important, urgent) => {
    const { activeSessionId, tasks } = get()
    const t = newTask(activeSessionId, text, important, urgent)
    await saveTask(t)
    set({ tasks: [...tasks, t] })
    return t
  },

  updateTask: async (id, patch) => {
    const { tasks } = get()
    const updated = tasks.map(t =>
      t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
    )
    const task = updated.find(t => t.id === id)
    await saveTask(task)
    set({ tasks: updated })
  },

  updateTaskPhysics: (id, patch) => {
    set(state => ({
      tasks: state.tasks.map(t => t.id === id ? { ...t, ...patch } : t)
    }))
  },

  flushPhysics: async () => {
    const { tasks } = get()
    await saveTasksBatch(tasks.filter(t => t.status === 'not_started'))
  },

  deleteTask: async (id) => {
    await deleteTaskFromDB(id)
    set(state => ({ tasks: state.tasks.filter(t => t.id !== id) }))
  },

  bulkUpdateTasks: async (ids, patch) => {
    const { tasks } = get()
    const now = Date.now()
    const updated = tasks.map(t =>
      ids.includes(t.id) ? { ...t, ...patch, updatedAt: now } : t
    )
    const toSave = updated.filter(t => ids.includes(t.id))
    await saveTasksBatch(toSave)
    set({ tasks: updated })
  },

  bulkDeleteTasks: async (ids) => {
    for (const id of ids) await deleteTaskFromDB(id)
    set(state => ({ tasks: state.tasks.filter(t => !ids.includes(t.id)) }))
  },

  importTasks: async (rows) => {
    const { activeSessionId, tasks } = get()
    const now = Date.now()
    const newTasks = rows.map(r => ({
      id: crypto.randomUUID(),
      sessionId: activeSessionId,
      text: r.text,
      status: 'not_started',
      important: r.important === 'true' || r.important === true,
      urgent: r.urgent === 'true' || r.urgent === true,
      createdAt: now,
      updatedAt: now,
      lastTouchedAt: now,
      finishedAt: null,
      colorOverride: null,
      sortIndex: now,
      posX: Math.random() * 600 + 100,
      posY: Math.random() * 400 + 100,
      velX: (Math.random() - 0.5) * 2,
      velY: (Math.random() - 0.5) * 2,
    }))
    await saveTasksBatch(newTasks)
    set({ tasks: [...tasks, ...newTasks] })
  },

  // ── Appearance settings ────────────────────────────────────────────────────
  setCardColors: async (colors) => {
    await setSetting('cardColors', colors)
    set({ cardColors: colors })
  },

  setCanvasBg: async (color) => {
    await setSetting('canvasBg', color)
    set({ canvasBg: color })
  },

  setGrowthSpeed: async (speed) => {
    await setSetting('growthSpeed', speed)
    set({ growthSpeed: speed })
  },

  setCanvasBgImage: async (dataUrl) => {
    await setSetting('canvasBgImage', dataUrl)
    set({ canvasBgImage: dataUrl })
  },

  setPanelOpacity: async (opacity) => {
    await setSetting('panelOpacity', opacity)
    set({ panelOpacity: opacity })
  },

  setSoundVolume: async (vol) => {
    await setSetting('soundVolume', vol)
    set({ soundVolume: vol })
  },

  setSortPref: async (key, value) => {
    const { sorts } = get()
    const updated = { ...sorts, [key]: value }
    await setSetting('sorts', updated)
    set({ sorts: updated })
  },

  reorderTasks: async (ids) => {
    const { tasks } = get()
    const now = Date.now()
    const updated = tasks.map(t => {
      const idx = ids.indexOf(t.id)
      if (idx === -1) return t
      return { ...t, sortIndex: idx * 1000, updatedAt: now }
    })
    await saveTasksBatch(updated.filter(t => ids.includes(t.id)))
    set({ tasks: updated })
  },

  // ── UI toggles ─────────────────────────────────────────────────────────────
  setView: (v) => set({ view: v }),
  setShowCreateModal: (v) => set({ showCreateModal: v }),
  setShowSessionManager: (v) => set({ showSessionManager: v }),
  setShowSettings: (v) => set({ showSettings: v }),
  setShowImportExport: (v) => set({ showImportExport: v }),
}))

export default useStore
