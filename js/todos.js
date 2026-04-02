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
  // Load todos — exclude closed ones from previous sessions
  const { data: todos } = await db
    .from('todos')
    .select('*')
    .order('sort_order')

  const seenIds = new Set()
  todosList = (todos || []).filter(t => {
    if (seenIds.has(t.id)) return false
    seenIds.add(t.id)
    return true
  })

  // Load kanban columns
  const { data: cols } = await db
    .from('kanban_columns')
    .select('*')
    .order('sort_order')

  const EXCLUDED_TITLES = ['To Do', KANBAN_SOURCE_TITLE]
  const seenTitles = new Set()
  let uniqueCols = (cols || []).filter(c => {
    if (EXCLUDED_TITLES.includes(c.title)) return false
    if (seenTitles.has(c.title)) return false
    seenTitles.add(c.title)
    return true
  })

  // Ensure default cols exist
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

  // Closed always last
  const closedCol = uniqueCols.find(c => c.title === KANBAN_CLOSED_COL)
  const otherCols = uniqueCols.filter(c => c.title !== KANBAN_CLOSED_COL)
  kanbanColumns = closedCol ? [...otherCols, closedCol] : otherCols

  await cargarTodosSummary()
}

// ==================== RENDER ====================

function renderTodos() {
  if (todosMode === 'list') renderLista()
  else renderKanban()
}

// ==================== FECHA ====================

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

function diasVencidos(todo) {
  if (todo.status === 'done' || todo.status === 'closed') return -Infinity
  return diasEntre(todo.started_at, null) || 0
}

// ==================== LISTA ====================

function renderLista() {
  const body = document.getElementById('todos-body')
  body.innerHTML = ''
  body.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;'

  const title = document.getElementById('todos-panel-title')
  if (title) title.textContent = "To-Do's"

  const zona = document.createElement('div')
  zona.id = 'todos-zona'
  zona.style.cssText = 'padding:10px;flex:1;overflow-y:auto;min-height:0;'
  body.appendChild(zona)

  // Active todos — sorted by days open descending (oldest first)
  const activos = todosList
    .filter(t => t.status === 'pending' || t.status === 'in_progress')
    .sort((a, b) => {
      const da = diasEntre(a.started_at, null) || 0
      const db2 = diasEntre(b.started_at, null) || 0
      return db2 - da // oldest first
    })

  // Done todos — sorted by completed_at descending (most recent first)
  const hechos = todosList
    .filter(t => t.status === 'done')
    .sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0))

  const todos = [...activos, ...hechos]

  if (!todos.length) {
    zona.innerHTML = '<p style="color:var(--text3);font-size:13px;text-align:center;padding:1rem;">No tasks yet.</p>'
  } else {
    todos.forEach(todo => zona.appendChild(crearTodoItem(todo)))
  }

  zona.addEventListener('dragover', e => {
    e.preventDefault()
    const afterEl = getDragAfterElement(zona, e.clientY, '.todo-item')
    limpiarIndicadores(zona)
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

  // Reporte
  const rw = renderReporte('lista')
  body.appendChild(rw)
}

function crearTodoItem(todo) {
  const div = document.createElement('div')
  div.className = 'todo-item'
  div.draggable = true
  div.dataset.id = todo.id
  div.innerHTML = `
    <div class="todo-check ${todo.status === 'done' ? 'done' : ''}"
      onclick="toggleTodoStatus('${todo.id}')"></div>
    <div style="flex:1">
      <div class="todo-text ${todo.status === 'done' ? 'done' : ''}"
        contenteditable="true"
        onblur="actualizarTextoTodo('${todo.id}', this.textContent)">
        ${descifrar(todo.text_enc)}
      </div>
      <div class="todo-item-fecha">
        ${todo.started_at ? 'Started: ' + fmtFecha(todo.started_at) : ''}
        ${todo.completed_at ? ' · Done: ' + fmtFecha(todo.completed_at) : ''}
      </div>
    </div>
    <button onclick="eliminarTodo('${todo.id}')"
      style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:12px;padding:2px 4px;flex-shrink:0;">✕</button>
  `

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

  return div
}

// ==================== KANBAN ====================

function renderKanban() {
  const body = document.getElementById('todos-body')
  body.innerHTML = ''
  body.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;'

  const title = document.getElementById('todos-panel-title')
  if (title) title.textContent = 'Kanban'

  const zona = document.createElement('div')
  zona.id = 'kanban-zona'
  zona.style.cssText = 'display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;align-items:flex-start;padding:10px;flex:1;min-height:0;'
  body.appendChild(zona)

  // Source column — mirror of To-Do's (active only)
  const sourceTodos = todosList
    .filter(t => t.status === 'pending' && !t.kanban_column_id)
    .sort((a, b) => {
      const da = diasEntre(a.started_at, null) || 0
      const db2 = diasEntre(b.started_at, null) || 0
      return db2 - da
    })

  zona.appendChild(crearKanbanColSource(sourceTodos))

  // Track rendered IDs — source todos are rendered
  const renderedIds = new Set(sourceTodos.map(t => t.id))

  // User-defined kanban columns
  kanbanColumns.forEach(col => {
    const isLocked = col.title === KANBAN_CLOSED_COL

    // For closed col: show todos with status=closed from current session
    // For other cols: show in_progress todos assigned to this col
    const items = todosList
      .filter(t => {
        if (t.kanban_column_id !== col.id) return false
        if (renderedIds.has(t.id)) return false
        // Don't show closed items from previous sessions (loaded from DB with closed status but no current session flag)
        if (isLocked && t.status !== 'closed') return false
        if (!isLocked && t.status === 'closed') return false
        renderedIds.add(t.id)
        return true
      })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

    zona.appendChild(crearKanbanCol(col, items, isLocked))
  })

  // Add column button — insert before closed
  const userCols = kanbanColumns.filter(c => c.title !== KANBAN_CLOSED_COL)
  if (userCols.length < 4) {
    const addCol = document.createElement('button')
    addCol.className = 'kanban-add-col'
    addCol.textContent = '+ Add column'
    addCol.onclick = agregarColumna
    // Insert before last child (Closed col)
    const children = zona.children
    if (children.length > 0) {
      zona.insertBefore(addCol, children[children.length - 1])
    } else {
      zona.appendChild(addCol)
    }
  }

  // Reporte
  const rw = renderReporte('kanban')
  body.appendChild(rw)
}

function crearKanbanColSource(sourceTodos) {
  const colDiv = document.createElement('div')
  colDiv.className = 'kanban-col col-source'
  colDiv.dataset.colId = 'source'
  colDiv.style.cssText = 'min-width:150px;flex:1;overflow-y:auto;max-height:calc(100vh - 240px);'

  colDiv.innerHTML = `
    <div class="kanban-col-header">
      <span class="kanban-col-title source-title">✅ To-Do's</span>
      <span class="kanban-col-count">${sourceTodos.length}</span>
    </div>
  `

  sourceTodos.forEach(todo => {
    const card = crearKanbanCard(todo, 'source', false, true)
    colDiv.appendChild(card)
  })

  // Drop handler — moving card back to To-Do's
  colDiv.addEventListener('dragover', e => {
    e.preventDefault()
    const afterEl = getDragAfterElement(colDiv, e.clientY, '.kanban-card')
    limpiarIndicadores(colDiv)
    const ind = crearIndicador()
    afterEl ? colDiv.insertBefore(ind, afterEl) : colDiv.appendChild(ind)
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
  colDiv.style.cssText = 'min-width:150px;flex:1;overflow-y:auto;max-height:calc(100vh - 240px);'

  const esOwner = !sesionActual || true

  colDiv.innerHTML = `
    <div class="kanban-col-header">
      <span class="kanban-col-title ${isLocked ? 'closed-title' : ''}"
        contenteditable="${!isLocked && esOwner}"
        data-col-id="${col.id}"
        data-original="${col.title}"
        ${!isLocked ? `onblur="renombrarColumna('${col.id}', this)"` : ''}>
        ${col.title}
      </span>
      <span class="kanban-col-count">${items.length}</span>
      ${!isLocked && esOwner ? `<button class="kanban-col-delete" onclick="eliminarColumna('${col.id}')">✕</button>` : ''}
    </div>
  `

  const addBtn = document.createElement('button')
  addBtn.className = 'kanban-add-btn'
  addBtn.textContent = '+ Add task'
  addBtn.onclick = () => agregarTodoEnColumna(col.id)

  items.forEach(todo => colDiv.appendChild(crearKanbanCard(todo, col.id, isLocked, false)))
  if (!isLocked) colDiv.appendChild(addBtn)

  // Dragover
  colDiv.addEventListener('dragover', e => {
    e.preventDefault()
    const afterEl = getDragAfterElement(colDiv, e.clientY, '.kanban-card')
    limpiarIndicadores(colDiv)
    const ind = crearIndicador()
    if (afterEl) colDiv.insertBefore(ind, afterEl)
    else if (!isLocked) colDiv.insertBefore(ind, addBtn)
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
      // Move to Closed — keep visible this session
      todo.kanban_column_id = col.id
      todo.status = 'closed'
      todo.completed_at = new Date().toISOString()

      await db.from('todos').update({
        kanban_column_id: col.id,
        status: 'closed',
        completed_at: todo.completed_at
      }).eq('id', draggedTodo)

      draggedTodo = null
      renderTodos()
      await cargarTodosSummary()
      return
    }

    // Move to regular kanban col
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

    await db.from('todos').update({
      kanban_column_id: col.id,
      status: 'in_progress'
    }).eq('id', draggedTodo)

    await Promise.all(colItems.map(t =>
      db.from('todos').update({ sort_order: t.sort_order }).eq('id', t.id)
    ))

    draggedTodo = null
    renderTodos()
    await cargarTodosSummary()
  })

  return colDiv
}

// ==================== REPORTE ====================

function renderReporte(modo) {
  const wrap = document.createElement('div')
  wrap.className = `reporte-wrap ${reporteOculto ? 'collapsed' : 'expanded'}`

  const isOpen = !reporteOculto

  // Active: oldest first (most days open at top)
  const activos = todosList
    .filter(t => t.status !== 'done' && t.status !== 'closed')
    .sort((a, b) => {
      const da = diasEntre(b.started_at, null) || 0
      const db2 = diasEntre(a.started_at, null) || 0
      return da - db2 // oldest first = more days = higher
    })

  // Closed/done: most recent first
  const cerrados = todosList
    .filter(t => t.status === 'done' || t.status === 'closed')
    .sort((a, b) => {
      const ta = new Date(b.completed_at || b.updated_at || 0)
      const tb = new Date(a.completed_at || a.updated_at || 0)
      return ta - tb
    })

  const items = [...activos, ...cerrados]

  const header = document.createElement('div')
  header.className = 'reporte-header'
  header.onclick = toggleReporte
  header.innerHTML = `
    <div class="reporte-header-left">
      <span class="reporte-titulo">Activity log</span>
      <span class="reporte-count">${items.length}</span>
      <span style="font-size:10px;color:var(--text3);">DD/MM/YYYY</span>
    </div>
    <span class="reporte-toggle ${isOpen ? 'open' : ''}">▾</span>
  `
  wrap.appendChild(header)

  const bodyEl = document.createElement('div')
  bodyEl.className = `reporte-body${isOpen ? ' open' : ''}`

  if (!items.length) {
    bodyEl.innerHTML = '<p style="font-size:12px;color:var(--text3);text-align:center;padding:12px;">No activity yet.</p>'
  } else {
    items.forEach(todo => {
      const col = kanbanColumns.find(c => c.id === todo.kanban_column_id)
      const isClosed = todo.status === 'closed' || todo.status === 'done'
      const dias = isClosed
        ? diasEntre(todo.started_at, todo.completed_at)
        : diasEntre(todo.started_at, null)

      const diasLabel = dias !== null ? (isClosed ? `${dias}d` : `${dias}d open`) : '—'
      const diasClass = isClosed ? 'ok' : (dias !== null && dias > 7 ? 'vencido' : '')

      const dotClass = todo.status === 'closed' ? 'closed'
        : todo.status === 'done' ? 'done'
        : todo.status === 'in_progress' ? 'in_progress'
        : 'pending'

      const row = document.createElement('div')
      row.className = 'reporte-item'
      row.innerHTML = `
        <div class="reporte-dot ${dotClass}"></div>
        <div style="flex:1;min-width:0;">
          <div class="reporte-texto">${descifrar(todo.text_enc)}</div>
          ${modo === 'kanban' && col ? `<div style="font-size:10px;color:var(--text3);">${col.title}</div>` : ''}
          ${todo.status === 'closed' ? `<div style="font-size:10px;color:var(--success);">Closed · ${fmtFecha(todo.completed_at)}</div>` : ''}
        </div>
        <div class="reporte-fechas">
          <span class="reporte-fecha">Start: ${fmtFecha(todo.started_at)}</span>
          <span class="reporte-fecha">End: ${fmtFecha(todo.completed_at)}</span>
        </div>
        <span class="reporte-dias ${diasClass}">${diasLabel}</span>
        <button class="reporte-delete" onclick="eliminarDeReporte('${todo.id}')">✕</button>
      `
      bodyEl.appendChild(row)
    })
  }

  wrap.appendChild(bodyEl)
  return wrap
}

function toggleReporte() {
  reporteOculto = !reporteOculto

  document.querySelectorAll('.reporte-wrap').forEach(wrap => {
    wrap.classList.toggle('collapsed', reporteOculto)
    wrap.classList.toggle('expanded', !reporteOculto)
    const body = wrap.querySelector('.reporte-body')
    const toggle = wrap.querySelector('.reporte-toggle')
    if (body) body.classList.toggle('open', !reporteOculto)
    if (toggle) toggle.classList.toggle('open', !reporteOculto)
  })
}

// ==================== KANBAN CARD ====================

function crearKanbanCard(todo, colId, isLocked = false, isSource = false) {
  const card = document.createElement('div')
  card.className = `kanban-card${isLocked ? ' closed-card' : ''}`
  card.draggable = !isLocked
  card.dataset.id = todo.id

  const dias = diasEntre(todo.started_at, null)
  const diasStr = dias !== null ? `${dias}d` : ''

  card.innerHTML = `
    <div class="kanban-card-text">${descifrar(todo.text_enc)}</div>
    <div style="font-size:10px;color:var(--text3);margin-top:3px;display:flex;justify-content:space-between;">
      <span>${fmtFecha(todo.started_at)}</span>
      ${diasStr ? `<span style="color:${dias > 7 ? 'var(--danger)' : 'var(--text3)'};">${diasStr}</span>` : ''}
    </div>
  `

  if (!isLocked) {
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
        e.stopPropagation()
        abrirTodoCard(todo, card)
      })
    }
  }

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
      onblur="actualizarTextoTodo('${todo.id}', this.textContent)">
      ${descifrar(todo.text_enc)}
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:8px;">
      <button onclick="event.stopPropagation();eliminarTodo('${todo.id}')"
        style="font-size:11px;padding:3px 10px;border-radius:6px;border:none;background:var(--danger);color:#fff;cursor:pointer;font-family:var(--font);">
        Delete
      </button>
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
  const texto = input.value.trim()
  if (!texto) return

  const { data } = await db.from('todos').insert({
    text_enc: cifrar(texto),
    status: 'pending',
    kanban_column_id: null,
    sort_order: todosList.length,
    started_at: new Date().toISOString(),
    created_by: sesionActual.user.id
  }).select().single()

  if (data) {
    todosList.push(data)
    input.value = ''
    renderTodos()
    await cargarTodosSummary()
  }
}

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
  renderTodos()
  await cargarTodosSummary()
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
    todo_id: id,
    note_id: null,
    text_enc: todo.text_enc,
    status: todo.status,
    kanban_column_id: todo.kanban_column_id,
    sort_order: todo.sort_order,
    started_at: todo.started_at,
    completed_at: todo.completed_at,
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
  if (!texto) return

  const colItems = todosList.filter(t => t.kanban_column_id === colId)
  const { data } = await db.from('todos').insert({
    text_enc: cifrar(texto),
    status: 'in_progress',
    kanban_column_id: colId,
    sort_order: colItems.length,
    started_at: new Date().toISOString(),
    created_by: sesionActual.user.id
  }).select().single()

  if (data) {
    todosList.push(data)
    renderTodos()
    await cargarTodosSummary()
  }
}

async function agregarColumna() {
  const userCols = kanbanColumns.filter(c => c.title !== KANBAN_CLOSED_COL)
  if (userCols.length >= 4) {
    return alert('Maximum columns reached (6 total: To-Do\'s + 4 custom + Closed).')
  }

  const titulo = prompt('Column name:')
  if (!titulo) return

  if ([KANBAN_CLOSED_COL, KANBAN_SOURCE_TITLE, 'To Do'].includes(titulo)) {
    return alert(`"${titulo}" is a reserved column name.`)
  }

  const existe = kanbanColumns.some(c => c.title.toLowerCase() === titulo.toLowerCase())
  if (existe) return alert(`A column named "${titulo}" already exists.`)

  const closedCol = kanbanColumns.find(c => c.title === KANBAN_CLOSED_COL)
  const newOrder = closedCol ? closedCol.sort_order : kanbanColumns.length

  const { data } = await db.from('kanban_columns').insert({
    title: titulo,
    sort_order: newOrder,
    created_by: sesionActual.user.id
  }).select().single()

  if (data) {
    if (closedCol) {
      closedCol.sort_order = newOrder + 1
      await db.from('kanban_columns').update({ sort_order: closedCol.sort_order }).eq('id', closedCol.id)
    }
    const insertIdx = kanbanColumns.findIndex(c => c.title === KANBAN_CLOSED_COL)
    if (insertIdx >= 0) kanbanColumns.splice(insertIdx, 0, data)
    else kanbanColumns.push(data)
    renderTodos()
    await cargarTodosSummary()
  }
}

async function renombrarColumna(id, el) {
  const trimmed = el.textContent.trim()
  if (!trimmed) { el.textContent = el.dataset.original || ''; return }

  if ([KANBAN_CLOSED_COL, KANBAN_SOURCE_TITLE, 'To Do'].includes(trimmed)) {
    el.textContent = el.dataset.original || trimmed
    return alert(`"${trimmed}" is a reserved name.`)
  }

  const existe = kanbanColumns.some(c => c.id !== id && c.title.toLowerCase() === trimmed.toLowerCase())
  if (existe) {
    el.classList.add('error')
    el.textContent = el.dataset.original || trimmed
    setTimeout(() => el.classList.remove('error'), 1500)
    const colDiv = el.closest('.kanban-col')
    if (colDiv) {
      let warn = colDiv.querySelector('.col-name-warning')
      if (!warn) {
        warn = document.createElement('div')
        warn.className = 'col-name-warning'
        colDiv.insertBefore(warn, colDiv.children[1])
      }
      warn.textContent = `"${trimmed}" already exists.`
      warn.classList.add('show')
      setTimeout(() => warn.classList.remove('show'), 3000)
    }
    return
  }

  await db.from('kanban_columns').update({ title: trimmed }).eq('id', id)
  const col = kanbanColumns.find(c => c.id === id)
  if (col) {
    col.title = trimmed
    el.dataset.original = trimmed
  }

  // Update sidebar immediately
  await cargarTodosSummary()
}

async function eliminarColumna(id) {
  const col = kanbanColumns.find(c => c.id === id)
  if (!col) return
  if (col.title === KANBAN_CLOSED_COL) return alert('The Closed column cannot be deleted.')

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

  const restores = data[idx].snapshot.map(t => ({
    note_id: null,
    text_enc: cifrar(t.text),
    status: t.status,
    kanban_column_id: t.kanban_column_id,
    sort_order: t.sort_order,
    started_at: t.started_at,
    completed_at: t.completed_at,
    created_by: sesionActual.user.id
  }))

  await db.from('todos').insert(restores)
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