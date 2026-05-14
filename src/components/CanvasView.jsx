import { useEffect, useRef, useCallback, useState } from 'react'
import useStore, { getAgingScale, DEFAULT_CARD_COLORS, applySort } from '../store/useStore'
import TaskEditModal from './TaskEditModal'

// ── Layout constants ──────────────────────────────────────────────────────────
const BOARD_W        = 280
const BOARD_MARGIN   = 20
const BIN_W          = 120
const BIN_H          = 90
const BIN_MARGIN     = 20
const FINISHED_W     = BOARD_W
const FINISHED_H     = 90
const FINISHED_GAP   = 18
const CARD_BASE_W    = 190
const CARD_FONT_SIZE = 15
const PINNED_FONT    = 16
const CARD_PAD_X     = 14
const CARD_PAD_Y     = 12
const LINE_HEIGHT    = 1.45
const CARD_GAP       = 10
const BOARD_HEADER_H = 76
const BOARD_INNER    = 12
const CARD_RADIUS    = 12
const PROX_BOARD     = 180
const PROX_BIN       = 140
const PROX_FINISHED  = 140
const GRAB_SCALE     = 1.15

// ── Colour helpers ────────────────────────────────────────────────────────────
function cardColor(task, colors = DEFAULT_CARD_COLORS) {
  if (task.colorOverride) return task.colorOverride   // per-task override wins
  if (task.important && task.urgent) return colors.critical
  if (task.important) return colors.important
  if (task.urgent) return colors.urgent
  return colors.default
}

function lerp(a, b, t) { return a + (b - a) * Math.min(Math.max(t, 0), 1) }

function cardLabel(task) {
  const icons = []
  if (task.important) icons.push('★')
  if (task.urgent) icons.push('⚡')
  return icons.length ? icons.join('') + ' ' + task.text : task.text
}

// ── Elapsed time ──────────────────────────────────────────────────────────────
function timeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60)   return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60)   return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)    return `${hr}h ago`
  const days = Math.floor(hr / 24)
  return `${days}d ago`
}

// ── Text wrapping ─────────────────────────────────────────────────────────────
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let cur = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (cur && ctx.measureText(test).width > maxWidth) {
      lines.push(cur)
      cur = word
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

// ── Card dimension helpers ────────────────────────────────────────────────────
function floatingDims(ctx, task, scale) {
  const w = CARD_BASE_W * scale
  const fontSize = Math.max(12, CARD_FONT_SIZE * scale)
  ctx.font = `${fontSize}px -apple-system, Arial, sans-serif`
  const lines = wrapText(ctx, cardLabel(task), w - CARD_PAD_X * 2)
  const h = CARD_PAD_Y * 2 + lines.length * fontSize * LINE_HEIGHT
  return { w, h, lines, fontSize }
}

function pinnedDims(ctx, task, cardW) {
  ctx.font = `${PINNED_FONT}px -apple-system, Arial, sans-serif`
  const lines = wrapText(ctx, cardLabel(task), cardW - CARD_PAD_X * 2)
  const textH = lines.length * PINNED_FONT * LINE_HEIGHT
  const dateH = Math.round(PINNED_FONT * 0.82) + 8   // timestamp + elapsed
  const h = CARD_PAD_Y * 2 + textH + dateH
  return { w: cardW, h, lines }
}

function taskFits(ctx, pinned, newTask, bw, bh) {
  const cardW = bw - BOARD_INNER * 2
  let used = BOARD_HEADER_H + BOARD_INNER
  const all = [...pinned, newTask]
  for (let i = 0; i < all.length; i++) {
    used += pinnedDims(ctx, all[i], cardW).h
    if (i < all.length - 1) used += CARD_GAP
  }
  used += BOARD_INNER
  return used <= bh
}

// ── Draw helpers ──────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawFloating(ctx, task, cx, cy, w, h, lines, fontSize, shadow, colors) {
  const x = cx - w / 2
  const y = cy - h / 2
  const col = cardColor(task, colors)

  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5
  }
  roundRect(ctx, x, y, w, h, CARD_RADIUS)
  ctx.fillStyle = col.bg; ctx.fill()
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
  ctx.strokeStyle = col.border; ctx.lineWidth = 2; ctx.stroke()

  ctx.fillStyle = col.text
  ctx.font = `${fontSize}px -apple-system, Arial, sans-serif`
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  let ty = y + CARD_PAD_Y
  for (const line of lines) {
    ctx.fillText(line, x + CARD_PAD_X, ty)
    ty += fontSize * LINE_HEIGHT
  }
}

function drawPinned(ctx, task, cx, cy, w, h, lines, colors) {
  const x = cx - w / 2
  const y = cy - h / 2
  const col = cardColor(task, colors)

  ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4
  roundRect(ctx, x, y, w, h, CARD_RADIUS)
  ctx.fillStyle = col.bg; ctx.fill()
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
  ctx.strokeStyle = col.border; ctx.lineWidth = 2; ctx.stroke()

  ctx.font = `${PINNED_FONT}px -apple-system, Arial, sans-serif`
  ctx.fillStyle = col.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  let ty = y + CARD_PAD_Y
  for (const line of lines) {
    ctx.fillText(line, x + CARD_PAD_X, ty)
    ty += PINNED_FONT * LINE_HEIGHT
  }

  // Timestamp + elapsed
  const dateFont = Math.round(PINNED_FONT * 0.82)
  ctx.font = `${dateFont}px -apple-system, Arial, sans-serif`
  ctx.fillStyle = col.text + '99'
  const dt = new Date(task.createdAt).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  ctx.fillText(`${dt}  ·  ${timeAgo(task.createdAt)}`, x + CARD_PAD_X, ty + 2)
}

function drawBoard(ctx, bx, by, bw, bh, count, denied, op = 0.95) {
  ctx.fillStyle = `rgba(255,255,255,${op})`
  roundRect(ctx, bx, by, bw, bh, 12); ctx.fill()
  ctx.strokeStyle = denied ? '#e05252' : '#2E75B6'
  ctx.lineWidth = 2; ctx.setLineDash([8, 4])
  roundRect(ctx, bx, by, bw, bh, 12); ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = denied ? '#e05252' : '#2E75B6'
  ctx.font = 'bold 14px -apple-system, Arial, sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.fillText('WORKING ON IT', bx + bw / 2, by + 10)
  ctx.font = '12px -apple-system, Arial, sans-serif'
  ctx.fillText(denied ? 'NO SPACE' : `${count}`, bx + bw / 2, by + 30)
}

function drawBin(ctx, x, y, w, h, hover, op = 0.95) {
  ctx.fillStyle = hover ? `rgba(255,235,235,${Math.min(op + 0.02, 1)})` : `rgba(255,255,255,${op})`
  roundRect(ctx, x, y, w, h, 10); ctx.fill()
  ctx.strokeStyle = hover ? '#e05252' : '#999'
  ctx.lineWidth = 2; ctx.setLineDash([6, 3])
  roundRect(ctx, x, y, w, h, 10); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = hover ? '#e05252' : '#999'
  ctx.font = '22px -apple-system, Arial, sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('🗑', x + w / 2, y + h / 2 - 6)
  ctx.font = '11px -apple-system, Arial, sans-serif'
  ctx.fillText('DISCARD', x + w / 2, y + h - 14)
}

function drawFinished(ctx, x, y, w, h, hover, op = 0.95) {
  ctx.fillStyle = hover ? `rgba(235,255,242,${Math.min(op + 0.02, 1)})` : `rgba(255,255,255,${op})`
  roundRect(ctx, x, y, w, h, 10); ctx.fill()
  ctx.strokeStyle = hover ? '#2E8B57' : '#888'
  ctx.lineWidth = 2; ctx.setLineDash([6, 3])
  roundRect(ctx, x, y, w, h, 10); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = hover ? '#2E8B57' : '#888'
  ctx.font = '22px -apple-system, Arial, sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('✓', x + w / 2, y + h / 2 - 6)
  ctx.font = '11px -apple-system, Arial, sans-serif'
  ctx.fillText('FINISHED', x + w / 2, y + h - 14)
}

// ── Pinned layout ─────────────────────────────────────────────────────────────
function layoutPinned(ctx, tasks, bx, by, bw, bh) {
  if (tasks.length === 0) return []
  const cardW = bw - BOARD_INNER * 2
  const result = []
  let curY = by + BOARD_HEADER_H + BOARD_INNER
  for (const task of tasks) {
    const { h, lines } = pinnedDims(ctx, task, cardW)
    result.push({ task, cx: bx + bw / 2, cy: curY + h / 2, w: cardW, h, lines })
    curY += h + CARD_GAP
  }
  return result
}

function distToRect(px, py, rx, ry, rw, rh) {
  const dx = Math.max(rx - px, 0, px - (rx + rw))
  const dy = Math.max(ry - py, 0, py - (ry + rh))
  return Math.sqrt(dx * dx + dy * dy)
}

// Returns where in the vertical stack a dropped card should be inserted
function getInsertionIndex(cy, pinnedLayout) {
  for (let i = 0; i < pinnedLayout.length; i++) {
    if (cy < pinnedLayout[i].cy) return i
  }
  return pinnedLayout.length
}

// Returns the Y pixel position of the insertion indicator line
function computeInsertionY(insertIdx, pinnedLayout, boardY) {
  if (pinnedLayout.length === 0) return boardY + BOARD_HEADER_H + BOARD_INNER
  if (insertIdx === 0) return pinnedLayout[0].cy - pinnedLayout[0].h / 2 - CARD_GAP / 2
  if (insertIdx >= pinnedLayout.length) {
    const last = pinnedLayout[pinnedLayout.length - 1]
    return last.cy + last.h / 2 + CARD_GAP / 2
  }
  const above = pinnedLayout[insertIdx - 1]
  const below = pinnedLayout[insertIdx]
  return (above.cy + above.h / 2 + below.cy - below.h / 2) / 2
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CanvasView() {
  const canvasRef        = useRef(null)
  const stateRef         = useRef({})
  const dragRef          = useRef(null)
  const animRef          = useRef(null)
  const physicsFlushRef  = useRef(null)
  const layoutRef        = useRef({ floating: [], pinned: [], board: null, bin: null, finished: null })
  const bgImageRef       = useRef(null)

  const [editingTask, setEditingTask] = useState(null)

  const tasks             = useStore(s => s.tasks)
  const sessions          = useStore(s => s.sessions)
  const activeSessionId   = useStore(s => s.activeSessionId)
  const updateTaskPhysics = useStore(s => s.updateTaskPhysics)
  const updateTask        = useStore(s => s.updateTask)
  const flushPhysics      = useStore(s => s.flushPhysics)
  const setShowCreateModal = useStore(s => s.setShowCreateModal)
  const cardColors        = useStore(s => s.cardColors)
  const canvasBg          = useStore(s => s.canvasBg)
  const growthSpeed       = useStore(s => s.growthSpeed)
  const canvasBgImage     = useStore(s => s.canvasBgImage)
  const panelOpacity      = useStore(s => s.panelOpacity)
  const sorts             = useStore(s => s.sorts)
  const setSortPref       = useStore(s => s.setSortPref)
  const reorderTasks      = useStore(s => s.reorderTasks)

  const session  = sessions.find(s => s.id === activeSessionId)
  const paused   = session?.paused   ?? false
  const pausedAt = session?.pausedAt ?? null

  useEffect(() => {
    stateRef.current = { tasks, paused, pausedAt, cardColors, canvasBg, growthSpeed, panelOpacity, sorts }
  }, [tasks, paused, pausedAt, cardColors, canvasBg, growthSpeed, panelOpacity, sorts])

  // Load bg image into an Image element whenever the data URL changes
  useEffect(() => {
    if (canvasBgImage) {
      const img = new Image()
      img.onload = () => { bgImageRef.current = img }
      img.src = canvasBgImage
    } else {
      bgImageRef.current = null
    }
  }, [canvasBgImage])

  // ── Animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function resize() {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    function tick() {
      animRef.current = requestAnimationFrame(tick)
      const { tasks, paused, pausedAt, cardColors, canvasBg, growthSpeed, panelOpacity, sorts } = stateRef.current
      const pOp = panelOpacity ?? 0.95
      // Freeze aging at the moment of pausing so cards don't grow while paused
      const now = (paused && pausedAt) ? pausedAt : Date.now()
      const colors = cardColors || DEFAULT_CARD_COLORS
      const drag = dragRef.current
      const W = canvas.width
      const H = canvas.height

      // ── Zone geometry ──────────────────────────────────────────────────────
      const bx = W - BOARD_W - BOARD_MARGIN
      const by = BOARD_MARGIN
      const bw = BOARD_W
      const bh = H - BOARD_MARGIN * 2 - FINISHED_H - FINISHED_GAP

      const finX  = bx
      const finY  = H - FINISHED_H - BIN_MARGIN
      const finCx = finX + FINISHED_W / 2
      const finCy = finY + FINISHED_H / 2

      const binX  = BIN_MARGIN
      const binY  = H - BIN_H - BIN_MARGIN
      const binCx = binX + BIN_W / 2
      const binCy = binY + BIN_H / 2

      ctx.clearRect(0, 0, W, H)
      if (bgImageRef.current) {
        ctx.drawImage(bgImageRef.current, 0, 0, W, H)
      } else {
        ctx.fillStyle = canvasBg || '#fafafa'; ctx.fillRect(0, 0, W, H)
      }

      if (paused) {
        ctx.fillStyle = 'rgba(200,200,220,0.18)'; ctx.fillRect(0, 0, W, H)
      }

      const workingTasks = tasks.filter(t => t.status === 'working')

      // ── Hover / denied states ──────────────────────────────────────────────
      let binHover    = false
      let finHover    = false
      let boardDenied = false

      if (drag) {
        const dx = drag.cx - binCx, dy = drag.cy - binCy
        binHover = Math.sqrt(dx * dx + dy * dy) < PROX_BIN

        const fdx = drag.cx - finCx, fdy = drag.cy - finCy
        finHover = Math.sqrt(fdx * fdx + fdy * fdy) < PROX_FINISHED

        if (distToRect(drag.cx, drag.cy, bx, by, bw, bh) < PROX_BOARD) {
          const dragTask = tasks.find(t => t.id === drag.taskId)
          if (dragTask && dragTask.status !== 'working') {
            boardDenied = !taskFits(ctx, workingTasks, dragTask, bw, bh)
          }
        }
      }

      drawBoard(ctx, bx, by, bw, bh, workingTasks.length, boardDenied, pOp)
      drawBin(ctx, binX, binY, BIN_W, BIN_H, binHover, pOp)
      drawFinished(ctx, finX, finY, FINISHED_W, FINISHED_H, finHover, pOp)

      // ── Floating tasks: physics + draw ────────────────────────────────────
      const floatingLayout = []
      for (const task of tasks) {
        if (task.status !== 'not_started') continue
        if (drag?.taskId === task.id) continue

        const scale = getAgingScale(task.lastTouchedAt, now, growthSpeed || 'medium')
        const { w, h, lines, fontSize } = floatingDims(ctx, task, scale)
        const hw = w / 2, hh = h / 2

        let { posX, posY, velX, velY } = task

        if (!paused) {
          posX += velX; posY += velY

          const rightBound = W - BOARD_W - BOARD_MARGIN - 10
          if (posX - hw < 0)          { posX = hw;              velX =  Math.abs(velX) }
          if (posX + hw > rightBound) { posX = rightBound - hw; velX = -Math.abs(velX) }
          if (posY - hh < 0)          { posY = hh;              velY =  Math.abs(velY) }
          if (posY + hh > H)          { posY = H - hh;          velY = -Math.abs(velY) }

          const speed = Math.sqrt(velX * velX + velY * velY)
          if (speed > 2.5)    { velX *= 2.5 / speed; velY *= 2.5 / speed }
          if (speed < 0.4)    { velX = (Math.random() - 0.5) * 0.8; velY = (Math.random() - 0.5) * 0.8 }

          updateTaskPhysics(task.id, { posX, posY, velX, velY })
        }

        drawFloating(ctx, task, posX, posY, w, h, lines, fontSize, false, colors)
        floatingLayout.push({ id: task.id, cx: posX, cy: posY, w, h })
      }

      // ── Pinned tasks: draw (sorted) ───────────────────────────────────────
      const boardSort     = sorts?.board || 'custom'
      const sortedWorking = applySort(workingTasks, boardSort)
      const pinLayout     = layoutPinned(ctx, sortedWorking, bx, by, bw, bh)
      const pinnedLayout  = []
      for (const { task, cx, cy, w, h, lines } of pinLayout) {
        if (drag?.taskId === task.id) continue
        drawPinned(ctx, task, cx, cy, w, h, lines, colors)
        pinnedLayout.push({ id: task.id, cx, cy, w, h })
      }

      layoutRef.current = {
        floating: floatingLayout,
        pinned:   pinnedLayout,
        board:    { x: bx, y: by, w: bw, h: bh },
        bin:      { x: binX, y: binY, w: BIN_W,      h: BIN_H,      cx: binCx, cy: binCy },
        finished: { x: finX, y: finY, w: FINISHED_W, h: FINISHED_H, cx: finCx, cy: finCy },
      }

      // ── Insertion indicator (custom board sort, dragging working card) ────
      if (drag && boardSort === 'custom') {
        const dragTask = tasks.find(t => t.id === drag.taskId)
        if (dragTask?.status === 'working') {
          const dBoard = distToRect(drag.cx, drag.cy, bx, by, bw, bh)
          if (dBoard < PROX_BOARD) {
            const insertIdx = getInsertionIndex(drag.cy, pinnedLayout)
            const insertY   = computeInsertionY(insertIdx, pinnedLayout, by)
            ctx.strokeStyle = '#2E75B6'; ctx.lineWidth = 3; ctx.setLineDash([])
            ctx.beginPath()
            ctx.moveTo(bx + BOARD_INNER + 4, insertY)
            ctx.lineTo(bx + bw - BOARD_INNER - 4, insertY)
            ctx.stroke()
            ctx.fillStyle = '#2E75B6'
            ;[bx + BOARD_INNER + 4, bx + bw - BOARD_INNER - 4].forEach(x => {
              ctx.beginPath(); ctx.arc(x, insertY, 4, 0, Math.PI * 2); ctx.fill()
            })
          }
        }
      }

      // ── Dragged card on top ───────────────────────────────────────────────
      if (drag) {
        const task = tasks.find(t => t.id === drag.taskId)
        if (task) {
          const { cx, cy } = drag
          const dBoard = distToRect(cx, cy, bx, by, bw, bh)
          const dBin   = Math.sqrt((cx - binCx) ** 2 + (cy - binCy) ** 2)
          const dFin   = Math.sqrt((cx - finCx) ** 2 + (cy - finCy) ** 2)

          const tBoard = 1 - Math.min(dBoard / PROX_BOARD,    1)
          const tBin   = 1 - Math.min(dBin   / PROX_BIN,     1)
          const tFin   = 1 - Math.min(dFin   / PROX_FINISHED, 1)
          const maxSink = Math.max(tBin, tFin)

          let scale = GRAB_SCALE
          if (tBoard > maxSink) {
            scale = lerp(GRAB_SCALE, 1.2, tBoard)
          } else if (maxSink > 0) {
            scale = lerp(GRAB_SCALE, 0.55, maxSink)
          }

          const { w, h, lines, fontSize } = floatingDims(ctx, task, scale)
          drawFloating(ctx, task, cx, cy, w, h, lines, fontSize, true, colors)
        }
      }

      if (paused) {
        ctx.fillStyle = 'rgba(80,80,120,0.55)'
        ctx.font = 'bold 30px -apple-system, Arial, sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('⏸ PAUSED', W / 2, H / 2)
      }
    }

    animRef.current = requestAnimationFrame(tick)
    physicsFlushRef.current = setInterval(() => flushPhysics(), 5000)

    return () => {
      cancelAnimationFrame(animRef.current)
      clearInterval(physicsFlushRef.current)
      window.removeEventListener('resize', resize)
    }
  }, []) // eslint-disable-line

  // ── Mouse events ───────────────────────────────────────────────────────────
  const getXY = useCallback((e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }, [])

  const hitTest = useCallback((x, y) => {
    const { floating, pinned } = layoutRef.current
    const { tasks } = stateRef.current
    for (let i = pinned.length - 1; i >= 0; i--) {
      const { id, cx, cy, w, h } = pinned[i]
      if (x >= cx - w/2 && x <= cx + w/2 && y >= cy - h/2 && y <= cy + h/2)
        return tasks.find(t => t.id === id) || null
    }
    for (let i = floating.length - 1; i >= 0; i--) {
      const { id, cx, cy, w, h } = floating[i]
      if (x >= cx - w/2 && x <= cx + w/2 && y >= cy - h/2 && y <= cy + h/2)
        return tasks.find(t => t.id === id) || null
    }
    return null
  }, [])

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    const { x, y } = getXY(e)
    const task = hitTest(x, y)
    if (!task) return
    updateTask(task.id, { lastTouchedAt: Date.now() })
    dragRef.current = { taskId: task.id, cx: x, cy: y }
    canvasRef.current.style.cursor = 'grabbing'
  }, [getXY, hitTest, updateTask])

  const onMouseMove = useCallback((e) => {
    const { x, y } = getXY(e)
    if (dragRef.current) {
      dragRef.current.cx = x; dragRef.current.cy = y
    } else {
      canvasRef.current.style.cursor = hitTest(x, y) ? 'grab' : 'default'
    }
  }, [getXY, hitTest])

  const onMouseUp = useCallback(() => {
    if (!dragRef.current) return
    const { tasks } = stateRef.current
    const { taskId, cx, cy } = dragRef.current
    dragRef.current = null
    canvasRef.current.style.cursor = 'default'

    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const { board, bin, finished } = layoutRef.current
    if (!board || !bin || !finished) return

    const ctx    = canvasRef.current.getContext('2d')

    const dBin   = Math.sqrt((cx - bin.cx) ** 2      + (cy - bin.cy) ** 2)
    const dFin   = Math.sqrt((cx - finished.cx) ** 2 + (cy - finished.cy) ** 2)
    const dBoard = distToRect(cx, cy, board.x, board.y, board.w, board.h)
    const pinned = tasks.filter(t => t.status === 'working' && t.id !== taskId)

    if (dBin < PROX_BIN) {
      updateTask(taskId, { status: 'discarded', posX: cx, posY: cy })
    } else if (dFin < PROX_FINISHED) {
      updateTask(taskId, { status: 'finished', posX: cx, posY: cy, finishedAt: Date.now() })
    } else if (dBoard < PROX_BOARD && task.status !== 'working') {
      if (taskFits(ctx, pinned, task, board.w, board.h)) {
        updateTask(taskId, { status: 'working', posX: cx, posY: cy, lastTouchedAt: Date.now() })
      } else {
        updateTask(taskId, {
          posX: cx, posY: cy,
          velX: (Math.random() - 0.5) * 3,
          velY: (Math.random() - 0.5) * 3,
        })
      }
    } else if (task.status === 'working' && dBoard >= PROX_BOARD) {
      updateTask(taskId, {
        status: 'not_started', posX: cx, posY: cy,
        velX: (Math.random() - 0.5) * 2, velY: (Math.random() - 0.5) * 2,
        lastTouchedAt: Date.now(),
      })
    } else if (task.status === 'working' && dBoard < PROX_BOARD) {
      // Reorder within board — always allowed, auto-switches sort to custom
      const { sorts: currentSorts } = stateRef.current
      const workingTasks  = tasks.filter(t => t.status === 'working')
      const sortedWorking = applySort(workingTasks, currentSorts?.board || 'custom')
      const others        = sortedWorking.filter(t => t.id !== taskId)
      const insertIdx     = getInsertionIndex(cy, layoutRef.current.pinned)
      const newOrder      = [...others]
      newOrder.splice(insertIdx, 0, task)
      reorderTasks(newOrder.map(t => t.id))
      setSortPref('board', 'custom')
    } else {
      updateTask(taskId, { posX: cx, posY: cy })
    }
  }, [updateTask, reorderTasks])

  const onContextMenu = useCallback((e) => {
    e.preventDefault()
    const { x, y } = getXY(e)
    const task = hitTest(x, y)
    if (task) setEditingTask({ ...task })
  }, [getXY, hitTest])

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onContextMenu={onContextMenu}
      />
      <div
        style={{
          position: 'absolute', bottom: 28, left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.92)', border: '1px solid #ddd',
          borderRadius: 28, padding: '9px 24px', fontSize: 14, color: '#555',
          cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          userSelect: 'none',
        }}
        onClick={() => setShowCreateModal(true)}
      >
        + Add task
      </div>

      {/* Board sort control — overlaid on canvas, inside board header area */}
      <div style={{
        position: 'absolute', right: BOARD_MARGIN, top: BOARD_MARGIN + 52,
        width: BOARD_W, display: 'flex', justifyContent: 'center',
        pointerEvents: 'none', zIndex: 5,
      }}>
        <select
          value={sorts?.board || 'custom'}
          onChange={e => setSortPref('board', e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          style={{
            pointerEvents: 'auto', fontSize: 11, padding: '2px 6px',
            borderRadius: 6, border: '1px solid #cce', cursor: 'pointer',
            background: 'rgba(255,255,255,0.88)', fontFamily: 'inherit',
            color: '#2E75B6', fontWeight: 600,
          }}
        >
          <option value="custom">⠿ Custom order</option>
          <option value="alpha">A → Z</option>
          <option value="alpha_desc">Z → A</option>
          <option value="created">Oldest first</option>
          <option value="created_desc">Newest first</option>
        </select>
      </div>

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  )
}
