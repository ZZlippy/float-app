import { openDB } from 'idb'

const DB_NAME = 'float-db'
const DB_VERSION = 1

let dbPromise = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' })
          taskStore.createIndex('sessionId', 'sessionId')
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function getAllSessions() {
  const db = await getDB()
  return db.getAll('sessions')
}

export async function saveSession(session) {
  const db = await getDB()
  await db.put('sessions', session)
}

export async function deleteSessionFromDB(sessionId) {
  const db = await getDB()
  const tx = db.transaction(['sessions', 'tasks'], 'readwrite')
  await tx.objectStore('sessions').delete(sessionId)
  const idx = tx.objectStore('tasks').index('sessionId')
  const keys = await idx.getAllKeys(sessionId)
  for (const key of keys) await tx.objectStore('tasks').delete(key)
  await tx.done
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function getTasksForSession(sessionId) {
  const db = await getDB()
  const idx = db.transaction('tasks').store.index('sessionId')
  return idx.getAll(sessionId)
}

export async function saveTask(task) {
  const db = await getDB()
  await db.put('tasks', task)
}

export async function deleteTaskFromDB(taskId) {
  const db = await getDB()
  await db.delete('tasks', taskId)
}

export async function saveTasksBatch(tasks) {
  const db = await getDB()
  const tx = db.transaction('tasks', 'readwrite')
  for (const t of tasks) tx.store.put(t)
  await tx.done
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSetting(key) {
  const db = await getDB()
  const row = await db.get('settings', key)
  return row ? row.value : undefined
}

export async function setSetting(key, value) {
  const db = await getDB()
  await db.put('settings', { key, value })
}
