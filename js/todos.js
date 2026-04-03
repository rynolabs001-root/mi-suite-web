let todosPanel = null
let todosMode = 'list'
let kanbanColumns = []
let todosList = []
let draggedTodo = null
let _expandedCard = null
let _expandedTodo = null
let reporteOculto = false

const KANBAN_CLOSED_COL = 'Closed'
const KANBAN_SOURCE_TITLE = "To-Do's"
const KANBAN_DEFAULT_COLS = ['In Progress', 'Negotiating', 'Closed']

// ==================== INICIAR ====================

async function iniciarTodos() {
  todosPanel = document.getElementById('todos-panel')
  if (!todosPanel) return
  const visible = todosPanel.style.display === 'flex'
  if (visible) { cerrarTodos(); return }
  const resizer3 = document.getElementById('resizer-3')
  const editor = document.getElementById('editor-panel')
  todosPanel.style.display = 'flex'
  todosPanel.style.flex = '1'
  todosPanel.style.width = 'auto'
  todosPanel.style.minWidth = '250px'
  if (resizer3) resizer3.style.display = 'block'
  if (editor) { editor.style.flex = '1'; editor.style.minWidth = '300px' }
  await cargarTodosGlobal()
  renderTodos()
}

function cerrarTodos() {
  if (!todosPanel) return
  todosPanel.style.display = 'none'
  todosPanel.style.flex = ''
  todosPanel.style.width = ''
  todosPanel.style.minWidth = ''
  const resizer3 = document.getElementById('resizer-3')
  if (resizer3) resizer3.style.display = 'none'
  const editor = document.getElementById('editor-panel')
  if (editor) { editor.style.flex = '1'; editor.style.minWidth = '300px' }
}

// ==================== CARGAR ====================

async function cargarTodosGlobal() {
  const { data: todos } = await db.from('todos').select('*').order('sort_order')
  const seenIds = new Set()
  todosList = (todos || []).filter(t => {
    if (seenIds.has(t.id)) return false
    seenIds.add(t.id)
    return true
  })

  const { data: cols } = await db.from('kanban_columns').select('*').order('sort_order')
  const seenTitles = new Set()
  let uniqueCols = (cols || []).filter(c => {
    if (['To Do', KANBAN_SOURCE_TITLE].includes(c.title)) return false
    if (seenTitles.has(c.title)) return false
    seenTitles.add(c.title)
    return true
  })

  for (const title of KANBAN_DEFAULT_COLS) {
    if (!uniqueCols.find(c => c.title === title)) {
      const { data } = await db.from('kanban_columns').insert({
        title,
        sort_order: uniqueCols.length,
        created_by: sesionActual.user.id
      }).select().single()
      if (data) uniqueCols.push(data)
    }
  }

  const closedCol = uniqueCols.find(c => c.title === KANBAN_CLOSED_COL)
  const otherCols = uniqueCols.filter(c => c.title !== KANBAN_CLOSED_COL)
  kanbanColumns = closedCol ? [...otherCols, closedCol] : otherCols

  await cargarTodosSummary()
}

// Called by refresh button
async function refreshClosed() {
  const { data: todos } = await db.from('todos').select('*').order('sort_order')
  const seenIds = new Set()
  todosList = (todos || []).filter(t => {
    if (seenIds.has(t.id)) return false
    seenIds.add(t.id)
    return true
  })
  renderTodos()
  await cargarTodosSummary()
}

// ==================== RENDER ====================

function renderTodos() {
  if (todosMode === 'list') renderLista()
  else renderKanban()
}

// ==================== UTILS ====================

function fmtFecha(fecha) {
  if (!fecha) return '—'
  const d = new Date(fecha)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

function diasEntre(inicio, fin) {
  if (!inicio) return null
  const a = new Date(inicio)
  const b = fin ? new Date(fin) : new Date()
  return Math.floor((b - a) / (1000 * 60 * 60 * 24))
}

function isTerminal(status) {
  return ['done', 'closed', 'archived'].includes(status)
}

// ==================== LISTA ====================

function renderLista() {
  const body = document.getElementById('todos-body')
  body.innerHTML = ''
  body.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;min-height:0;'

  document.getElementById('todos-panel-title').textContent = "To-Do's"

  const addBar = document.getElementById('todo-add-bar')
  if (addBar) addBar.style.display = (typeof esMobile === 'function' && esMobile()) ? 'none' : 'flex'

  const zona = document.createElement('div')
  zona.id = 'todos-zona'
  zona.style.cssText = 'padding:10px;flex:7;overflow-y:auto;min-height:0;'
  body.appendChild(zona)

  // Active only — done/closed/archived go to LOG only
  const activos = todosList
    .filter(t => t.status === 'pending' || t.status === 'in_progress')
    .sort((a, b) => (diasEntre(b.started_at, null) || 0) - (diasEntre(a.started_at, null) || 0))

  if (!activos.length) {
    zona.innerHTML = '<p style="color:var(--text3);font-size:13px;text-align:center;padding:1rem;">No tasks yet. Add one below!</p>'
  } else {
    activos.forEach(todo => zona.appendChild(crearTodoItem(todo)))
  }

  zona.addEventListener('dragover', e => {
    e.preventDefault()
    limpiarIndicadores(zona)
    const afterEl = getDragAfterElement(zona, e.clientY, '.todo-item')
    const ind = crearIndicador()
    afterEl ? zona.insertBefore(ind, afterEl) : zona.appendChild(ind)
  })

  zona.addEventListener('drop', e => {
    e.preventDefault()
    limpiarIndicadores(zona)
    if (!draggedTodo) return
    const afterEl = getDragAfterElement(zona, e.clientY, '.todo-item')
    const fromIdx = todosList.findIndex(t => t.id === draggedTodo)
    const [moved] = todosList.splice(fromIdx, 1)
    if (!afterEl) todosList.push(moved)
    else todosList.splice(todosList.findIndex(t => t.id === afterEl.dataset.id), 0, moved)
    todosList.forEach((t, i) => t.sort_order = i)
    renderTodos()
    Promise.all(todosList.map(t => db.from('todos').update({ sort_order: t.sort_order }).eq('id', t.id)))
    draggedTodo = null
  })

  const rw = renderReporte('lista')
  rw.style.flex = '3'
  rw.style.minHeight = '0'
  body.appendChild(rw)
}

function crearTodoItem(todo) {
  const div = document.createElement('div')
  div.className = 'todo-item'
  div.dataset.id = todo.id
  const dias = diasEntre(todo.started_at, null)
  const diasStr = dias !== null ? `${dias}d` : ''

  div.innerHTML = `
    <span class="todo-drag-handle" title="Drag">≡</span>
    <div class="todo-check" onclick="toggleTodoStatus('${todo.id}')"></div>
    <div style="flex:1">
      <div class="todo-text" contenteditable="true"
        onblur="actualizarTextoTodo('${todo.id}', this.textContent)">
        ${descifrar(todo.text_enc)}
      </div>
      <div class="todo-item-fecha">
        ${todo.started_at ? 'Started: ' + fmtFecha(todo.started_at) : ''}
        ${diasStr ? ` · <span style="color:${dias > 7 ? 'var(--danger)' : 'var(--text3)'};">${diasStr} open</span>` : ''}
      </div>
    </div>
    <button onclick="eliminarTodo('${todo.id}')"
      style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:12px;padding:2px 4px;flex-shrink:0;">✕</button>
  `

  div.draggable = true
  div.addEventListener('dragstart', e => {
    draggedTodo = todo.id
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => div.style.opacity = '0.4', 0)
  })
  div.addEventListener('dragend', () => {
    div.style.opacity = '1'
    draggedTodo = null
    limpiarIndicadores(document.getElementById('todos-zona'))
  })

  iniciarTouchDragTodo(div, todo)
  return div
}

// ==================== KANBAN ====================

function renderKanban() {
  const body = document.getElementById('todos-body')
  body.innerHTML = ''
  body.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;min-height:0;'

  document.getElementById('todos-panel-title').textContent = 'Kanban'

  const addBar = document.getElementById('todo-add-bar')
  if (addBar) addBar.style.display = 'none'

  const zona = document.createElement('div')
  zona.id = 'kanban-zona'
  zona.style.cssText = 'display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;align-items:flex-start;padding:10px;flex:7;min-height:0;'
  body.appendChild(zona)

  const sourceTodos = todosList
    .filter(t => t.status === 'pending')
    .sort((a, b) => (diasEntre(b.started_at, null) || 0) - (diasEntre(a.started_at, null) || 0))

  zona.appendChild(crearKanbanColSource(sourceTodos))
  const sourceIds = new Set(sourceTodos.map(t => t.id))

  kanbanColumns.forEach(col => {
    const isLocked = col.title === KANBAN_CLOSED_COL
    const items = isLocked
      ? [] // Closed col always empty — items disappear to log after 5s
      : todosList.filter(t =>
          t.kanban_column_id === col.id &&
          !sourceIds.has(t.id) &&
          t.status === 'in_progress'
        ).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

    zona.appendChild(crearKanbanCol(col, items, isLocked))
  })

  const userCols = kanbanColumns.filter(c => c.title !== KANBAN_CLOSED_COL)
  if (userCols.length < 4) {
    const addCol = document.createElement('button')
    addCol.className = 'kanban-add-col'
    addCol.textContent = '+ Add column'
    addCol.onclick = agregarColumna
    zona.insertBefore(addCol, zona.lastChild)
  }

  const rw = renderReporte('kanban')
  rw.style.flex = '3'
  rw.style.minHeight = '0'
  body.appendChild(rw)
}

function crearKanbanColSource(sourceTodos) {
  const colDiv = document.createElement('div')
  colDiv.className = 'kanban-col col-source'
  colDiv.dataset.colId = 'source'
  colDiv.style.cssText = 'min-width:150px;flex:1;overflow-y:auto;max-height:100%;'
  colDiv.innerHTML = `
    <div class="kanban-col-header">
      <span class="kanban-col-title source-title">✅ To-Do's</span>
      <span class="kanban-col-count">${sourceTodos.length}</span>
    </div>
  `
  sourceTodos.forEach(todo => colDiv.appendChild(crearKanbanCard(todo, 'source', false, true)))

  const addBtn = document.createElement('button')
  addBtn.className = 'kanban-add-btn'
  addBtn.textContent = '+ Add task'
  addBtn.onclick = async () => {
    const texto = prompt('Task name:')
    if (!texto || !sesionActual) return
    const { data, error } = await db.from('todos').insert({
      text_enc: cifrar(texto), status: 'pending', kanban_column_id: null,
      sort_order: todosList.length, started_at: new Date().toISOString(),
      created_by: sesionActual.user.id
    }).select().single()
    if (error) { console.error(error); return }
    if (data) { todosList.push(data); renderTodos(); await cargarTodosSummary() }
  }
  colDiv.appendChild(addBtn)

  colDiv.addEventListener('dragover', e => {
    e.preventDefault()
    limpiarIndicadores(colDiv)
    const addB = colDiv.querySelector('.kanban-add-btn')
    colDiv.insertBefore(crearIndicador(), addB)
  })
  colDiv.addEventListener('dragleave', e => {
    if (!colDiv.contains(e.relatedTarget)) limpiarIndicadores(colDiv)
  })
  colDiv.addEventListener('drop', async e => {
    e.preventDefault()
    limpiarIndicadores(colDiv)
    if (!draggedTodo) return
    const todo = todosList.find(t => t.id === draggedTodo)
    if (!todo) return
    todo.kanban_column_id = null
    todo.status = 'pending'
    await db.from('todos').update({ kanban_column_id: null, status: 'pending' }).eq('id', draggedTodo)
    draggedTodo = null
    renderTodos()
    await cargarTodosSummary()
  })

  return colDiv
}

function crearKanbanCol(col, items, isLocked) {
  const colDiv = document.createElement('div')
  colDiv.className = `kanban-col${isLocked ? ' col-closed' : ''}`
  colDiv.dataset.colId = col.id
  colDiv.style.cssText = 'min-width:150px;flex:1;overflow-y:auto;max-height:100%;'
  colDiv.innerHTML = `
    <div class="kanban-col-header">
      <span class="kanban-col-title ${isLocked ? 'closed-title' : ''}"
        contenteditable="${!isLocked}"
        data-col-id="${col.id}"
        data-original="${col.title}"
        ${!isLocked ? `onblur="renombrarColumna('${col.id}', this)"` : ''}>
        ${col.title}
      </span>
      <span class="kanban-col-count">${items.length}</span>
      ${!isLocked ? `<button class="kanban-col-delete" onclick="eliminarColumna('${col.id}')">✕</button>` : ''}
    </div>
  `

  if (isLocked) {
    const hint = document.createElement('div')
    hint.style.cssText = 'font-size:10px;color:var(--text3);text-align:center;padding:8px 4px;'
    hint.textContent = 'Drag here to close → moves to log in 5s'
    colDiv.appendChild(hint)
  } else {
    const addBtn = document.createElement('button')
    addBtn.className = 'kanban-add-btn'
    addBtn.textContent = '+ Add task'
    addBtn.onclick = () => agregarTodoEnColumna(col.id)
    items.forEach(todo => colDiv.appendChild(crearKanbanCard(todo, col.id, false, false)))
    colDiv.appendChild(addBtn)
  }

  colDiv.addEventListener('dragover', e => {
    e.preventDefault()
    const afterEl = getDragAfterElement(colDiv, e.clientY, '.kanban-card')
    limpiarIndicadores(colDiv)
    const addB = colDiv.querySelector('.kanban-add-btn')
    const ind = crearIndicador()
    if (afterEl) colDiv.insertBefore(ind, afterEl)
    else if (addB) colDiv.insertBefore(ind, addB)
    else colDiv.appendChild(ind)
  })
  colDiv.addEventListener('dragleave', e => {
    if (!colDiv.contains(e.relatedTarget)) limpiarIndicadores(colDiv)
  })
  colDiv.addEventListener('drop', async e => {
    e.preventDefault()
    limpiarIndicadores(colDiv)
    if (!draggedTodo) return
    const todo = todosList.find(t => t.id === draggedTodo)
    if (!todo) return

    if (isLocked) {
      // Moved to CLOSED → show briefly then archive to log after 5s
      await moverAClosed(todo, col.id)
      draggedTodo = null
      return
    }

    const afterEl = getDragAfterElement(colDiv, e.clientY, '.kanban-card')
    todosList = todosList.filter(t => t.id !== draggedTodo)
    todo.kanban_column_id = col.id
    todo.status = 'in_progress'

    if (!afterEl) {
      todo.sort_order = todosList.filter(t => t.kanban_column_id === col.id).length
      todosList.push(todo)
    } else {
      const insertIdx = todosList.findIndex(t => t.id === afterEl.dataset.id)
      todosList.splice(Math.max(0, insertIdx), 0, todo)
    }

    const colItems = todosList.filter(t => t.kanban_column_id === col.id)
    colItems.forEach((t, i) => t.sort_order = i)
    await db.from('todos').update({ kanban_column_id: col.id, status: 'in_progress' }).eq('id', draggedTodo)
    await Promise.all(colItems.map(t => db.from('todos').update({ sort_order: t.sort_order }).eq('id', t.id)))
    draggedTodo = null
    renderTodos()
    await cargarTodosSummary()
  })

  return colDiv
}

// Move to CLOSED — show card briefly for 5s then archive to log
async function moverAClosed(todo, colId) {
  const completedAt = new Date().toISOString()

  // Update in DB immediately
  await db.from('todos').update({
    kanban_column_id: colId,
    status: 'closed',
    completed_at: completedAt
  }).eq('id', todo.id)

  todo.kanban_column_id = colId
  todo.status = 'closed'
  todo.completed_at = completedAt

  // Show a temporary closed card in the CLOSED column
  const closedColEl = document.querySelector(`.kanban-col.col-closed`)
  if (closedColEl) {
    const tmpCard = document.createElement('div')
    tmpCard.className = 'kanban-card closed-card'
    tmpCard.style.cssText = 'opacity:1;transition:opacity 0.5s;'
    const dias = diasEntre(todo.started_at, completedAt)
    tmpCard.innerHTML = `
      <div class="kanban-card-text">${descifrar(todo.text_enc)}</div>
      <div style="font-size:10px;color:var(--success);margin-top:3px;">
        Closed · ${dias !== null ? dias + 'd' : '—'}
      </div>
    `
    // Insert before hint text
    const hint = closedColEl.querySelector('div')
    closedColEl.insertBefore(tmpCard, hint)

    // Update count badge
    const badge = closedColEl.querySelector('.kanban-col-count')
    if (badge) badge.textContent = '1'

    // After 5s → fade out → archive to log
    setTimeout(() => {
      tmpCard.style.opacity = '0'
      setTimeout(async () => {
        await db.from('todos').update({ status: 'archived' }).eq('id', todo.id)
        todo.status = 'archived'
        tmpCard.remove()
        if (badge) badge.textContent = '0'
        renderTodos()
        await cargarTodosSummary()
      }, 500)
    }, 3000)  // ← 3 segundos
  } else {
    // Fallback if col not in DOM
    setTimeout(async () => {
      await db.from('todos').update({ status: 'archived' }).eq('id', todo.id)
      todo.status = 'archived'
      renderTodos()
      await cargarTodosSummary()
    }, 5000)
  }

  await cargarTodosSummary()
}

// ==================== REPORTE (30%) ====================

function renderReporte(modo) {
  const wrap = document.createElement('div')
  wrap.className = 'reporte-wrap'
  wrap.style.cssText = `
    border-top:1px solid var(--border);display:flex;flex-direction:column;
    flex-shrink:0;min-height:42px;overflow:hidden;
    flex:${reporteOculto ? '0 0 42px' : '3'};
  `

  const activos = todosList
    .filter(t => !isTerminal(t.status))
    .sort((a, b) => (diasEntre(b.started_at, null) || 0) - (diasEntre(a.started_at, null) || 0))

  const cerrados = todosList
    .filter(t => isTerminal(t.status))
    .sort((a, b) =>
      new Date(b.completed_at || b.updated_at || 0) -
      new Date(a.completed_at || a.updated_at || 0)
    )

  const items = [...activos, ...cerrados]

  const header = document.createElement('div')
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px 8px;cursor:pointer;user-select:none;flex-shrink:0;'
  header.onclick = toggleReporte
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <span class="reporte-titulo">Activity log</span>
      <span class="reporte-count">${items.length}</span>
    </div>
    <span style="font-size:11px;color:var(--text3);display:inline-block;transition:transform 0.2s;${!reporteOculto ? 'transform:rotate(180deg)' : ''}">▾</span>
  `
  wrap.appendChild(header)

  const bodyEl = document.createElement('div')
  bodyEl.className = 'reporte-body'
  bodyEl.style.cssText = `overflow-y:auto;flex:1;min-height:0;display:${reporteOculto ? 'none' : 'block'};`

  if (!items.length) {
    bodyEl.innerHTML = '<p style="font-size:12px;color:var(--text3);text-align:center;padding:12px;">No activity yet.</p>'
  } else {
    items.forEach(todo => {
      const col = kanbanColumns.find(c => c.id === todo.kanban_column_id)
      const terminal = isTerminal(todo.status)
      const dias = terminal
        ? diasEntre(todo.started_at, todo.completed_at)
        : diasEntre(todo.started_at, null)
      const diasLabel = dias !== null ? (terminal ? `${dias}d` : `${dias}d open`) : '—'

function toggleReporte() {
  reporteOculto = !reporteOculto
  document.querySelectorAll('.reporte-wrap').forEach(wrap => {
    const body = wrap.querySelector('.reporte-body')
    const arrow = wrap.querySelector('span[style*="transform"]') || wrap.querySelector('span:last-child')
    wrap.style.flex = reporteOculto ? '0 0 42px' : '3'
    wrap.style.minHeight = '42px'
    if (body) body.style.display = reporteOculto ? 'none' : 'block'
    const zona = wrap.parentElement?.querySelector('#todos-zona, #kanban-zona')
    if (zona) zona.style.flex = reporteOculto ? '1' : '7'
  })
}

// ==================== DONE → LOG (2s) ====================

async function toggleTodoStatus(id) {
  const todo = todosList.find(t => t.id === id)
  if (!todo) return
  const nuevo = todo.status === 'done' ? 'pending' : 'done'
  const updates = {
    status: nuevo,
    completed_at: nuevo === 'done' ? new Date().toISOString() : null
  }
  await db.from('todos').update(updates).eq('id', id)
  todo.status = nuevo
  todo.completed_at = updates.completed_at

  if (nuevo === 'done') {
    const itemEl = document.querySelector(`.todo-item[data-id="${id}"]`)
    if (itemEl) {
      itemEl.querySelector('.todo-check')?.classList.add('done')
      itemEl.querySelector('.todo-text')?.classList.add('done')
      setTimeout(() => {
        itemEl.style.transition = 'opacity 0.4s, transform 0.4s'
        itemEl.style.opacity = '0'
        itemEl.style.transform = 'translateX(20px)'
        setTimeout(() => { renderTodos(); cargarTodosSummary() }, 400)
      }, 2000)
    } else {
      renderTodos()
      await cargarTodosSummary()
    }
  } else {
    renderTodos()
    await cargarTodosSummary()
  }
}

async function reabrirTodo(id) {
  const todo = todosList.find(t => t.id === id)
  if (!todo) return
  await db.from('todos').update({ status: 'pending', completed_at: null }).eq('id', id)
  todo.status = 'pending'
  todo.completed_at = null
  renderTodos()
  await cargarTodosSummary()
}

// ==================== TOUCH DRAG ====================

function iniciarTouchDragTodo(el, todo) {
  const handle = el.querySelector('.todo-drag-handle')
  if (!handle) return
  let startY = 0, clone = null, isDragging = false

  handle.addEventListener('touchstart', e => {
    e.stopPropagation()
    startY = e.touches[0].clientY
    isDragging = false
    setTimeout(() => {
      isDragging = true
      el.classList.add('dragging')
      const rect = el.getBoundingClientRect()
      clone = el.cloneNode(true)
      clone.style.cssText = `position:fixed;z-index:1000;pointer-events:none;width:${rect.width}px;opacity:0.85;background:var(--bg2);border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.15);top:${rect.top}px;left:${rect.left}px;`
      document.body.appendChild(clone)
    }, 150)
  }, { passive: true })

  handle.addEventListener('touchmove', e => {
    if (!isDragging || !clone) return
    e.preventDefault()
    const dy = e.touches[0].clientY - startY
    clone.style.top = `${el.getBoundingClientRect().top + dy}px`
    clone.style.display = 'none'
    const elUnder = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY)
    clone.style.display = ''
    document.querySelectorAll('.todo-item.drag-over').forEach(i => i.classList.remove('drag-over'))
    const target = elUnder?.closest('.todo-item')
    if (target && target !== el) target.classList.add('drag-over')
  }, { passive: false })

  handle.addEventListener('touchend', async e => {
    if (!isDragging) return
    isDragging = false
    el.classList.remove('dragging')
    if (clone) { clone.remove(); clone = null }
    const targets = [...document.querySelectorAll('.todo-item.drag-over')]
    for (const target of targets) {
      target.classList.remove('drag-over')
      if (target === el) continue
      const zona = document.getElementById('todos-zona')
      if (!zona) continue
      const rect = target.getBoundingClientRect()
      e.changedTouches[0].clientY < rect.top + rect.height / 2
        ? zona.insertBefore(el, target)
        : zona.insertBefore(el, target.nextSibling)
      const items = [...zona.querySelectorAll('.todo-item')]
      const fromIdx = todosList.findIndex(t => t.id === todo.id)
      const toIdx = items.indexOf(el)
      if (fromIdx !== -1 && toIdx !== -1) {
        const [moved] = todosList.splice(fromIdx, 1)
        todosList.splice(toIdx, 0, moved)
        todosList.forEach((t, i) => t.sort_order = i)
        await Promise.all(todosList.map(t => db.from('todos').update({ sort_order: t.sort_order }).eq('id', t.id)))
      }
    }
  }, { passive: true })
}

function iniciarTouchDragKanban(card, todo) {
  let startY = 0, startX = 0, clone = null, isDragging = false

  card.addEventListener('touchstart', e => {
    e.stopPropagation()
    startY = e.touches[0].clientY
    startX = e.touches[0].clientX
    isDragging = false
    setTimeout(() => {
      isDragging = true
      draggedTodo = todo.id
      card.style.opacity = '0.4'
      const rect = card.getBoundingClientRect()
      clone = card.cloneNode(true)
      clone.style.cssText = `position:fixed;z-index:1000;pointer-events:none;width:${rect.width}px;opacity:0.9;background:var(--bg);border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.2);top:${rect.top}px;left:${rect.left}px;`
      document.body.appendChild(clone)
    }, 150)
  }, { passive: true })

  card.addEventListener('touchmove', e => {
    if (!isDragging || !clone) return
    e.preventDefault()
    const dy = e.touches[0].clientY - startY
    const dx = e.touches[0].clientX - startX
    const rect = card.getBoundingClientRect()
    clone.style.top = `${rect.top + dy}px`
    clone.style.left = `${rect.left + dx}px`
    clone.style.display = 'none'
    const elUnder = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY)
    clone.style.display = ''
    document.querySelectorAll('.kanban-col').forEach(c => c.style.outline = '')
    elUnder?.closest('.kanban-col')?.style.setProperty('outline', '2px solid var(--accent)')
  }, { passive: false })

  card.addEventListener('touchend', async e => {
    if (!isDragging) return
    isDragging = false
    card.style.opacity = '1'
    if (clone) { clone.remove(); clone = null }
    document.querySelectorAll('.kanban-col').forEach(c => c.style.outline = '')
    const touch = e.changedTouches[0]
    const elUnder = document.elementFromPoint(touch.clientX, touch.clientY)
    const targetCol = elUnder?.closest('.kanban-col')
    if (!targetCol || !draggedTodo) { draggedTodo = null; return }
    const colId = targetCol.dataset.colId
    const todoDragged = todosList.find(t => t.id === draggedTodo)
    if (!todoDragged) { draggedTodo = null; return }
    if (colId === 'source') {
      todoDragged.kanban_column_id = null
      todoDragged.status = 'pending'
      await db.from('todos').update({ kanban_column_id: null, status: 'pending' }).eq('id', draggedTodo)
    } else if (targetCol.classList.contains('col-closed')) {
      const col = kanbanColumns.find(c => c.id === colId)
      if (col) await moverAClosed(todoDragged, colId)
    } else {
      todoDragged.kanban_column_id = colId
      todoDragged.status = 'in_progress'
      await db.from('todos').update({ kanban_column_id: colId, status: 'in_progress' }).eq('id', draggedTodo)
    }
    draggedTodo = null
    renderTodos()
    await cargarTodosSummary()
  }, { passive: true })
}

// ==================== KANBAN CARD ====================

function crearKanbanCard(todo, colId, isLocked = false, isSource = false) {
  const card = document.createElement('div')
  card.className = 'kanban-card'
  card.dataset.id = todo.id
  const dias = diasEntre(todo.started_at, null)
  const diasStr = dias !== null ? `${dias}d` : ''
  card.innerHTML = `
    <div class="kanban-drag-handle" title="Drag">≡</div>
    <div class="kanban-card-text">${descifrar(todo.text_enc)}</div>
    <div style="font-size:10px;color:var(--text3);margin-top:3px;display:flex;justify-content:space-between;">
      <span>${fmtFecha(todo.started_at)}</span>
      ${diasStr ? `<span style="color:${dias > 7 ? 'var(--danger)' : 'var(--text3)'};">${diasStr}</span>` : ''}
    </div>
  `
  card.draggable = true
  card.style.cursor = 'grab'
  card.addEventListener('dragstart', e => {
    if (_expandedCard) return e.preventDefault()
    draggedTodo = todo.id
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => card.style.opacity = '0.4', 0)
  })
  card.addEventListener('dragend', () => {
    card.style.opacity = '1'
    draggedTodo = null
    document.querySelectorAll('.drop-indicator').forEach(el => el.remove())
  })
  if (!isSource) {
    card.addEventListener('click', e => {
      if (e.target.classList.contains('kanban-drag-handle')) return
      e.stopPropagation()
      abrirTodoCard(todo, card)
    })
  }
  iniciarTouchDragKanban(card, todo)
  return card
}

function abrirTodoCard(todo, cardEl) {
  if (_expandedCard === cardEl) return
  if (_expandedCard) cerrarCardExpandida(_expandedCard, _expandedTodo)
  _expandedCard = cardEl
  _expandedTodo = todo
  cardEl.draggable = false
  cardEl.classList.add('expanded')
  cardEl.innerHTML = `
    <div contenteditable="true" class="kanban-card-edit" id="card-edit-${todo.id}"
      onblur="actualizarTextoTodo('${todo.id}', this.textContent)">${descifrar(todo.text_enc)}</div>
    <div style="display:flex;justify-content:flex-end;margin-top:8px;">
      <button onclick="event.stopPropagation();eliminarTodo('${todo.id}')"
        style="font-size:11px;padding:3px 10px;border-radius:6px;border:none;background:var(--danger);color:#fff;cursor:pointer;font-family:var(--font);">Delete</button>
    </div>
  `
  setTimeout(() => document.getElementById(`card-edit-${todo.id}`)?.focus(), 50)
  setTimeout(() => {
    function clickFuera(e) {
      if (cardEl.contains(e.target)) return
      cerrarCardExpandida(cardEl, todo)
      document.removeEventListener('click', clickFuera)
    }
    document.addEventListener('click', clickFuera)
    cardEl._clickFuera = clickFuera
  }, 400)
}

function cerrarCardExpandida(cardEl, todo) {
  if (!cardEl) return
  cardEl.classList.remove('expanded')
  cardEl.draggable = true
  const dias = diasEntre(todo.started_at, null)
  const diasStr = dias !== null ? `${dias}d` : ''
  cardEl.innerHTML = `
    <div class="kanban-drag-handle" title="Drag">≡</div>
    <div class="kanban-card-text">${descifrar(todo.text_enc)}</div>
    <div style="font-size:10px;color:var(--text3);margin-top:3px;display:flex;justify-content:space-between;">
      <span>${fmtFecha(todo.started_at)}</span>
      ${diasStr ? `<span style="color:${dias > 7 ? 'var(--danger)' : 'var(--text3)'};">${diasStr}</span>` : ''}
    </div>
  `
  if (cardEl._clickFuera) {
    document.removeEventListener('click', cardEl._clickFuera)
    delete cardEl._clickFuera
  }
  _expandedCard = null
  _expandedTodo = null
}

// ==================== DRAG HELPERS ====================

function getDragAfterElement(container, y, selector) {
  const elements = [...container.querySelectorAll(selector)]
    .filter(el => el.style.opacity !== '0.4' && !el.classList.contains('expanded'))
  return elements.reduce((closest, child) => {
    const box = child.getBoundingClientRect()
    const offset = y - box.top - box.height / 2
    if (offset < 0 && offset > closest.offset) return { offset, element: child }
    return closest
  }, { offset: Number.NEGATIVE_INFINITY }).element
}

function crearIndicador() {
  const el = document.createElement('div')
  el.className = 'drop-indicator'
  return el
}

function limpiarIndicadores(container) {
  ;(container || document).querySelectorAll('.drop-indicator').forEach(el => el.remove())
}

// ==================== ACCIONES ====================

async function agregarTodo() {
  const input = document.getElementById('todo-input')
  if (!input || !sesionActual) return
  const texto = input.value.trim()
  if (!texto) return
  const { data, error } = await db.from('todos').insert({
    text_enc: cifrar(texto), status: 'pending', kanban_column_id: null,
    sort_order: todosList.length, started_at: new Date().toISOString(),
    created_by: sesionActual.user.id
  }).select().single()
  if (error) { console.error('agregarTodo:', error); alert('Error: ' + error.message); return }
  if (data) { todosList.push(data); input.value = ''; input.focus(); renderTodos(); await cargarTodosSummary() }
}

async function actualizarTextoTodo(id, texto) {
  const enc = cifrar(texto.trim())
  await db.from('todos').update({ text_enc: enc }).eq('id', id)
  const todo = todosList.find(t => t.id === id)
  if (todo) todo.text_enc = enc
}

async function eliminarTodo(id) {
  const todo = todosList.find(t => t.id === id)
  if (!todo) return
  await db.from('todos_trash').insert({
    todo_id: id, text_enc: todo.text_enc, status: todo.status,
    kanban_column_id: todo.kanban_column_id, sort_order: todo.sort_order,
    started_at: todo.started_at, completed_at: todo.completed_at,
    deleted_by: sesionActual.user.id
  })
  await db.from('todos').delete().eq('id', id)
  todosList = todosList.filter(t => t.id !== id)
  _expandedCard = null
  _expandedTodo = null
  renderTodos()
  await cargarTodosSummary()
}

async function agregarTodoEnColumna(colId) {
  const texto = prompt('Task name:')
  if (!texto || !sesionActual) return
  const colItems = todosList.filter(t => t.kanban_column_id === colId)
  const { data, error } = await db.from('todos').insert({
    text_enc: cifrar(texto), status: 'in_progress', kanban_column_id: colId,
    sort_order: colItems.length, started_at: new Date().toISOString(),
    created_by: sesionActual.user.id
  }).select().single()
  if (error) { console.error('agregarTodoEnColumna:', error); return }
  if (data) { todosList.push(data); renderTodos(); await cargarTodosSummary() }
}

async function agregarColumna() {
  const userCols = kanbanColumns.filter(c => c.title !== KANBAN_CLOSED_COL)
  if (userCols.length >= 4) return alert("Maximum columns reached.")
  const titulo = prompt('Column name:')
  if (!titulo) return
  if ([KANBAN_CLOSED_COL, KANBAN_SOURCE_TITLE, 'To Do'].includes(titulo)) return alert(`"${titulo}" is reserved.`)
  if (kanbanColumns.some(c => c.title.toLowerCase() === titulo.toLowerCase())) return alert(`"${titulo}" already exists.`)
  const closedCol = kanbanColumns.find(c => c.title === KANBAN_CLOSED_COL)
  const newOrder = closedCol ? closedCol.sort_order : kanbanColumns.length
  const { data } = await db.from('kanban_columns').insert({
    title: titulo, sort_order: newOrder, created_by: sesionActual.user.id
  }).select().single()
  if (data) {
    if (closedCol) {
      closedCol.sort_order = newOrder + 1
      await db.from('kanban_columns').update({ sort_order: closedCol.sort_order }).eq('id', closedCol.id)
    }
    const insertIdx = kanbanColumns.findIndex(c => c.title === KANBAN_CLOSED_COL)
    insertIdx >= 0 ? kanbanColumns.splice(insertIdx, 0, data) : kanbanColumns.push(data)
    renderTodos()
    await cargarTodosSummary()
  }
}

async function renombrarColumna(id, el) {
  const trimmed = el.textContent.trim()
  if (!trimmed) { el.textContent = el.dataset.original || ''; return }
  if ([KANBAN_CLOSED_COL, KANBAN_SOURCE_TITLE, 'To Do'].includes(trimmed)) {
    el.textContent = el.dataset.original || trimmed
    return alert(`"${trimmed}" is reserved.`)
  }
  if (kanbanColumns.some(c => c.id !== id && c.title.toLowerCase() === trimmed.toLowerCase())) {
    el.classList.add('error')
    el.textContent = el.dataset.original || trimmed
    setTimeout(() => el.classList.remove('error'), 1500)
    return
  }
  await db.from('kanban_columns').update({ title: trimmed }).eq('id', id)
  const col = kanbanColumns.find(c => c.id === id)
  if (col) { col.title = trimmed; el.dataset.original = trimmed }
  await cargarTodosSummary()
}

async function eliminarColumna(id) {
  const col = kanbanColumns.find(c => c.id === id)
  if (!col || col.title === KANBAN_CLOSED_COL) return
  if (!confirm(`Delete column "${col.title}"? All tasks inside will be permanently deleted.`)) return
  await db.from('todos').delete().eq('kanban_column_id', id)
  todosList = todosList.filter(t => t.kanban_column_id !== id)
  await db.from('kanban_columns').delete().eq('id', id)
  kanbanColumns = kanbanColumns.filter(c => c.id !== id)
  renderTodos()
  await cargarTodosSummary()
}

async function eliminarDeReporte(id) {
  if (!confirm('Remove this entry?')) return
  await eliminarTodo(id)
}

// ==================== VERSIONES ====================

async function verVersionesTodos() {
  const { data } = await db.from('todos_versions').select('*').order('saved_at', { ascending: false })
  if (!data?.length) return alert('No saved versions.')
  const lista = data.map((v, i) => `${i + 1}. ${formatearFecha(v.saved_at)}`).join('\n')
  const sel = prompt(`Saved versions:\n${lista}\n\nEnter number to restore:`)
  if (!sel) return
  const idx = parseInt(sel) - 1
  if (isNaN(idx) || !data[idx]) return alert('Invalid number.')
  if (!confirm('Restore this version?')) return
  await db.from('todos').delete().is('note_id', null)
  await db.from('todos').insert(data[idx].snapshot.map(t => ({
    text_enc: cifrar(t.text), status: t.status, kanban_column_id: t.kanban_column_id,
    sort_order: t.sort_order, started_at: t.started_at, completed_at: t.completed_at,
    created_by: sesionActual.user.id
  })))
  await cargarTodosGlobal()
  renderTodos()
  alert('Version restored.')
}

// ==================== MODO ====================

function setTodosMode(mode) {
  todosMode = mode
  const tabList = document.getElementById('tab-list')
  const tabKanban = document.getElementById('tab-kanban')
  if (tabList) tabList.classList.toggle('active', mode === 'list')
  if (tabKanban) tabKanban.classList.toggle('active', mode === 'kanban')
  renderTodos()
}

async function reabrirTodo(id) {
  const todo = todosList.find(t => t.id === id)
  if (!todo) return
  await db.from('todos').update({ status: 'pending', completed_at: null }).eq('id', id)
  todo.status = 'pending'
  todo.completed_at = null
  renderTodos()
  await cargarTodosSummary()
}

async function verVersionesTodos() {
  const { data } = await db.from('todos_versions').select('*').order('saved_at', { ascending: false })
  if (!data?.length) return alert('No saved versions.')
  const lista = data.map((v, i) => `${i + 1}. ${formatearFecha(v.saved_at)}`).join('\n')
  const sel = prompt(`Saved versions:\n${lista}\n\nEnter number to restore:`)
  if (!sel) return
  const idx = parseInt(sel) - 1
  if (isNaN(idx) || !data[idx]) return alert('Invalid number.')
  if (!confirm('Restore this version?')) return
  await db.from('todos').delete().is('note_id', null)
  await db.from('todos').insert(data[idx].snapshot.map(t => ({
    text_enc: cifrar(t.text), status: t.status,
    kanban_column_id: t.kanban_column_id, sort_order: t.sort_order,
    started_at: t.started_at, completed_at: t.completed_at,
    created_by: sesionActual.user.id
  })))
  await cargarTodosGlobal()
  renderTodos()
  alert('Version restored.')
}

function setTodosMode(mode) {
  todosMode = mode
  const tabList = document.getElementById('tab-list')
  const tabKanban = document.getElementById('tab-kanban')
  if (tabList) tabList.classList.toggle('active', mode === 'list')
  if (tabKanban) tabKanban.classList.toggle('active', mode === 'kanban')
  renderTodos()
}