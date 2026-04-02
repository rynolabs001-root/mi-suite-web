let todosPanel = null
let todosMode = 'list'
let kanbanColumns = []
let todosList = []
let draggedTodo = null
let _expandedCard = null
let _expandedTodo = null
let reporteOculto = false

// ==================== INICIAR ====================

async function iniciarTodos() {
  if (!notaActual) {
    alert('Please select a note first.')
    return
  }

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
  todosPanel.style.maxWidth = 'none'

  if (resizer3) resizer3.style.display = 'block'
  if (editor) { editor.style.flex = '1'; editor.style.minWidth = '300px' }

  await cargarTodos()
  renderTodos()
}

function cerrarTodos() {
  if (!todosPanel) return
  todosPanel.style.display = 'none'
  todosPanel.style.flex = ''
  todosPanel.style.width = ''
  todosPanel.style.minWidth = ''
  todosPanel.style.maxWidth = ''

  const resizer3 = document.getElementById('resizer-3')
  if (resizer3) resizer3.style.display = 'none'

  const editor = document.getElementById('editor-panel')
  if (editor) {
    editor.style.flex = '1'
    editor.style.width = ''
    editor.style.minWidth = '300px'
  }
}

// ==================== CARGAR ====================

async function cargarTodos() {
  if (!notaActual) return

  const { data: cols } = await db
    .from('kanban_columns')
    .select('*')
    .eq('note_id', notaActual.id)
    .order('sort_order')

  if (!cols || cols.length === 0) {
    await crearColumnasDefault()
  } else {
    kanbanColumns = cols
  }

  const { data: todos } = await db
    .from('todos')
    .select('*')
    .eq('note_id', notaActual.id)
    .order('sort_order')

  todosList = todos || []
}

async function crearColumnasDefault() {
  if (!notaActual) return
  const defaults = ['To Do', 'In Progress', 'Done']
  const inserts = defaults.map((title, i) => ({
    note_id: notaActual.id,
    title,
    sort_order: i,
    created_by: sesionActual.user.id
  }))
  const { data } = await db.from('kanban_columns').insert(inserts).select()
  kanbanColumns = data || []
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
  if (todo.status === 'done') return -1
  return diasEntre(todo.started_at, null) || 0
}

// ==================== LISTA ====================

function renderLista() {
  const body = document.getElementById('todos-body')
  body.style.display = 'flex'
  body.style.flexDirection = 'column'
  body.style.overflowY = 'hidden'
  body.style.overflowX = 'hidden'
  body.style.padding = '0'
  body.innerHTML = ''

  const zona = document.createElement('div')
  zona.id = 'todos-zona'
  zona.style.padding = '10px'
  zona.style.flex = '7'
  zona.style.overflowY = 'auto'
  zona.style.minHeight = '0'
  body.appendChild(zona)

  const pendientes = todosList
    .filter(t => t.status !== 'done')
    .sort((a, b) => diasVencidos(b) - diasVencidos(a))

  const hechos = todosList
    .filter(t => t.status === 'done')
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))

  const todos = [...pendientes, ...hechos]

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
    if (!afterEl) {
      todosList.push(moved)
    } else {
      const toIdx = todosList.findIndex(t => t.id === afterEl.dataset.id)
      todosList.splice(toIdx, 0, moved)
    }
    todosList.forEach((t, i) => t.sort_order = i)
    renderTodos()
    Promise.all(todosList.map(t =>
      db.from('todos').update({ sort_order: t.sort_order }).eq('id', t.id)
    ))
    draggedTodo = null
  })

  const reporteWrap = renderReporte('lista')
  reporteWrap.style.flex = reporteOculto ? '0' : '3'
  reporteWrap.style.minHeight = '0'
  reporteWrap.style.display = 'flex'
  reporteWrap.style.flexDirection = 'column'
  body.appendChild(reporteWrap)
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
  body.style.display = 'flex'
  body.style.flexDirection = 'column'
  body.style.padding = '0'
  body.style.overflowY = 'hidden'
  body.innerHTML = ''

  const zona = document.createElement('div')
  zona.style.display = 'flex'
  zona.style.gap = '8px'
  zona.style.overflowX = 'auto'
  zona.style.overflowY = 'auto'
  zona.style.alignItems = 'flex-start'
  zona.style.padding = '10px'
  zona.style.flex = reporteOculto ? '1' : '7'
  zona.style.minHeight = '0'
  body.appendChild(zona)

  if (!kanbanColumns.length) {
    zona.innerHTML = '<p style="color:var(--text3);font-size:13px;text-align:center;padding:2rem;width:100%;">No columns yet.</p>'
    const rw = renderReporte('kanban')
    rw.style.flex = reporteOculto ? '0' : '3'
    rw.style.minHeight = '0'
    rw.style.display = 'flex'
    rw.style.flexDirection = 'column'
    body.appendChild(rw)
    return
  }

  const esOwner = !notaActual || notaActual?.author_id === sesionActual?.user?.id

  // Deduplicate: use a Set to track rendered todo IDs
  const renderedIds = new Set()

  kanbanColumns.forEach(col => {
    const items = todosList
      .filter(t => {
        if (t.kanban_column_id !== col.id) return false
        if (renderedIds.has(t.id)) return false
        renderedIds.add(t.id)
        return true
      })
      .sort((a, b) => a.sort_order - b.sort_order)

    const colDiv = document.createElement('div')
    colDiv.className = 'kanban-col'
    colDiv.dataset.colId = col.id
    colDiv.style.minWidth = '150px'
    colDiv.style.flex = '1'
    colDiv.style.overflowY = 'auto'

    colDiv.innerHTML = `
      <div class="kanban-col-header">
        <span class="kanban-col-title"
          contenteditable="${esOwner}"
          data-col-id="${col.id}"
          data-original="${col.title}"
          onblur="renombrarColumna('${col.id}', this)">
          ${col.title}
        </span>
        <span class="kanban-col-count">${items.length}</span>
        ${esOwner ? `<button class="kanban-col-delete" onclick="eliminarColumna('${col.id}')">✕</button>` : ''}
      </div>
    `

    const addBtn = document.createElement('button')
    addBtn.className = 'kanban-add-btn'
    addBtn.textContent = '+ Add task'
    addBtn.onclick = () => agregarTodoEnColumna(col.id)

    items.forEach(todo => colDiv.appendChild(crearKanbanCard(todo, col.id)))
    colDiv.appendChild(addBtn)

    colDiv.addEventListener('dragover', e => {
      e.preventDefault()
      const afterEl = getDragAfterElement(colDiv, e.clientY, '.kanban-card')
      limpiarIndicadores(colDiv)
      const ind = crearIndicador()
      afterEl ? colDiv.insertBefore(ind, afterEl) : colDiv.insertBefore(ind, addBtn)
    })

    colDiv.addEventListener('dragleave', e => {
      if (!colDiv.contains(e.relatedTarget)) limpiarIndicadores(colDiv)
    })

    colDiv.addEventListener('drop', e => {
      e.preventDefault()
      limpiarIndicadores(colDiv)
      if (!draggedTodo) return

      const afterEl = getDragAfterElement(colDiv, e.clientY, '.kanban-card')
      const todo = todosList.find(t => t.id === draggedTodo)
      if (!todo) return

      todosList = todosList.filter(t => t.id !== draggedTodo)
      todo.kanban_column_id = col.id

      if (!afterEl) {
        const colItems = todosList.filter(t => t.kanban_column_id === col.id)
        todo.sort_order = colItems.length
        todosList.push(todo)
      } else {
        const insertIdx = todosList.findIndex(t => t.id === afterEl.dataset.id)
        todosList.splice(Math.max(0, insertIdx), 0, todo)
      }

      const colItems = todosList.filter(t => t.kanban_column_id === col.id)
      colItems.forEach((t, i) => t.sort_order = i)

      renderTodos()

      Promise.all([
        db.from('todos').update({ kanban_column_id: col.id }).eq('id', draggedTodo),
        ...colItems.map(t => db.from('todos').update({ sort_order: t.sort_order }).eq('id', t.id))
      ])

      draggedTodo = null
    })

    zona.appendChild(colDiv)
  })

  if (kanbanColumns.length < 6 && esOwner) {
    const addCol = document.createElement('button')
    addCol.className = 'kanban-add-col'
    addCol.textContent = '+ Add column'
    addCol.onclick = agregarColumna
    zona.appendChild(addCol)
  }

  const reporteWrap = renderReporte('kanban')
  reporteWrap.style.flex = reporteOculto ? '0' : '3'
  reporteWrap.style.minHeight = '0'
  reporteWrap.style.display = 'flex'
  reporteWrap.style.flexDirection = 'column'
  body.appendChild(reporteWrap)
}

// ==================== REPORTE ====================

function renderReporte(modo) {
  const wrap = document.createElement('div')
  wrap.className = 'reporte-wrap'
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'column'
  wrap.style.minHeight = '0'
  wrap.style.flexShrink = '0'

  const isOpen = !reporteOculto

  const pendientes = todosList
    .filter(t => t.status !== 'done')
    .sort((a, b) => diasEntre(b.started_at, null) - diasEntre(a.started_at, null))

  const cerrados = todosList
    .filter(t => t.status === 'done')
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))

  const items = [...pendientes, ...cerrados]

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
  bodyEl.className = 'reporte-body' + (isOpen ? ' open' : '')

  if (!items.length) {
    bodyEl.innerHTML = '<p style="font-size:12px;color:var(--text3);text-align:center;padding:12px;">No activity yet.</p>'
  } else {
    items.forEach(todo => {
      const col = kanbanColumns.find(c => c.id === todo.kanban_column_id)
      const dias = todo.status === 'done'
        ? diasEntre(todo.started_at, todo.completed_at)
        : diasEntre(todo.started_at, null)

      const diasLabel = dias !== null
        ? (todo.status === 'done' ? `${dias}d` : `${dias}d open`)
        : '—'

      const diasClass = todo.status === 'done' ? 'ok' : (dias > 7 ? 'vencido' : '')

      const row = document.createElement('div')
      row.className = 'reporte-item'
      row.innerHTML = `
        <div class="reporte-dot ${todo.status}"></div>
        <div style="flex:1;min-width:0;">
          <div class="reporte-texto">${descifrar(todo.text_enc)}</div>
          ${modo === 'kanban' && col
            ? `<div style="font-size:10px;color:var(--text3);">${col.title}</div>`
            : ''}
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

  document.querySelectorAll('.reporte-body').forEach(el => {
    if (reporteOculto) {
      el.classList.remove('open')
      el.style.height = '0'
    } else {
      el.classList.add('open')
      el.style.height = '160px'
    }
  })

  document.querySelectorAll('.reporte-toggle').forEach(el => {
    el.classList.toggle('open', !reporteOculto)
  })

  document.querySelectorAll('.reporte-wrap').forEach(el => {
    el.style.flex = reporteOculto ? '0' : '3'
    el.style.overflow = reporteOculto ? 'hidden' : ''
    el.style.flexShrink = '0'
  })

  // Expand top zone when collapsed
  const zona = document.getElementById('todos-zona')
  if (zona) zona.style.flex = reporteOculto ? '1' : '7'
}

// ==================== CARD KANBAN ====================

function crearKanbanCard(todo, colId) {
  const card = document.createElement('div')
  card.className = 'kanban-card'
  card.draggable = true
  card.dataset.id = todo.id

  card.innerHTML = `
    <div class="kanban-card-text">${descifrar(todo.text_enc)}</div>
    ${todo.due_date ? `<div class="kanban-card-date">${fmtFecha(todo.due_date)}</div>` : ''}
    <div style="font-size:10px;color:var(--text3);margin-top:3px;">${fmtFecha(todo.started_at)}</div>
  `

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

  card.addEventListener('click', e => {
    e.stopPropagation()
    abrirTodoCard(todo, card)
  })

  return card
}

function abrirTodoCard(todo, cardEl) {
  if (_expandedCard === cardEl) return

  if (_expandedCard && _expandedCard !== cardEl) {
    cerrarCardExpandida(_expandedCard, _expandedTodo)
  }

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

  setTimeout(() => {
    const editEl = document.getElementById(`card-edit-${todo.id}`)
    if (editEl) editEl.focus()
  }, 50)

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
  cardEl.innerHTML = `
    <div class="kanban-card-text">${descifrar(todo.text_enc)}</div>
    ${todo.due_date ? `<div class="kanban-card-date">${fmtFecha(todo.due_date)}</div>` : ''}
    <div style="font-size:10px;color:var(--text3);margin-top:3px;">${fmtFecha(todo.started_at)}</div>
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
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child }
    }
    return closest
  }, { offset: Number.NEGATIVE_INFINITY }).element
}

function crearIndicador() {
  const el = document.createElement('div')
  el.className = 'drop-indicator'
  return el
}

function limpiarIndicadores(container) {
  const target = container || document
  target.querySelectorAll('.drop-indicator').forEach(el => el.remove())
}

// ==================== ACCIONES ====================

async function agregarTodo() {
  const input = document.getElementById('todo-input')
  const texto = input.value.trim()
  if (!texto) return

  const colDefault = kanbanColumns[0]?.id || null
  const noteId = notaActual?.id || null

  const insertData = {
    text_enc: cifrar(texto),
    status: 'pending',
    kanban_column_id: colDefault,
    sort_order: todosList.length,
    started_at: new Date().toISOString(),
    created_by: sesionActual.user.id
  }

  if (noteId) insertData.note_id = noteId

  const { data } = await db.from('todos').insert(insertData).select().single()

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
    note_id: todo.note_id || notaActual?.id,
    text_enc: todo.text_enc,
    status: todo.status,
    kanban_column_id: todo.kanban_column_id,
    sort_order: todo.sort_order,
    due_date: todo.due_date,
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
  const noteId = notaActual?.id || null

  const insertData = {
    text_enc: cifrar(texto),
    status: 'pending',
    kanban_column_id: colId,
    sort_order: colItems.length,
    started_at: new Date().toISOString(),
    created_by: sesionActual.user.id
  }

  if (noteId) insertData.note_id = noteId

  const { data } = await db.from('todos').insert(insertData).select().single()

  if (data) {
    todosList.push(data)
    renderTodos()
    await cargarTodosSummary()
  }
}

async function agregarColumna() {
  if (kanbanColumns.length >= 6) return alert('Maximum 6 columns allowed.')
  const titulo = prompt('Column name:')
  if (!titulo) return

  // Check duplicate name
  const existe = kanbanColumns.some(c => c.title.toLowerCase() === titulo.toLowerCase())
  if (existe) {
    alert(`A column named "${titulo}" already exists. Please use a different name.`)
    return
  }

  const noteId = notaActual?.id || null
  const insertData = {
    title: titulo,
    sort_order: kanbanColumns.length,
    created_by: sesionActual.user.id
  }
  if (noteId) insertData.note_id = noteId

  const { data } = await db.from('kanban_columns').insert(insertData).select().single()

  if (data) {
    kanbanColumns.push(data)
    renderTodos()
  }
}

async function renombrarColumna(id, el) {
  const trimmed = el.textContent.trim()
  if (!trimmed) {
    // Restore original
    el.textContent = el.dataset.original || ''
    return
  }

  // Check for duplicate — exclude current column
  const existe = kanbanColumns.some(c => c.id !== id && c.title.toLowerCase() === trimmed.toLowerCase())
  if (existe) {
    // Show inline error
    el.classList.add('error')
    el.textContent = el.dataset.original || trimmed
    setTimeout(() => el.classList.remove('error'), 1500)

    // Show warning
    const colDiv = el.closest('.kanban-col')
    if (colDiv) {
      let warn = colDiv.querySelector('.col-name-warning')
      if (!warn) {
        warn = document.createElement('div')
        warn.className = 'col-name-warning'
        warn.textContent = `"${trimmed}" already exists. Name was not changed.`
        colDiv.insertBefore(warn, colDiv.querySelector('.kanban-card') || colDiv.querySelector('.kanban-add-btn'))
      }
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
}

async function eliminarColumna(id) {
  if (kanbanColumns.length <= 1) return alert('You need at least one column.')
  if (!confirm('Delete this column? Tasks will move to the first column.')) return

  const primeraCol = kanbanColumns.find(c => c.id !== id)?.id
  if (!primeraCol) return

  await db.from('todos').update({ kanban_column_id: primeraCol }).eq('kanban_column_id', id)
  await db.from('kanban_columns').delete().eq('id', id)
  kanbanColumns = kanbanColumns.filter(c => c.id !== id)
  todosList.forEach(t => { if (t.kanban_column_id === id) t.kanban_column_id = primeraCol })
  renderTodos()
}

async function eliminarDeReporte(id) {
  if (!confirm('Remove this entry from the log?')) return
  await eliminarTodo(id)
}

// ==================== VERSIONES ====================

async function guardarVersionTodos() {
  const snapshot = todosList.map(t => ({
    id: t.id,
    text: descifrar(t.text_enc),
    status: t.status,
    kanban_column_id: t.kanban_column_id,
    sort_order: t.sort_order,
    started_at: t.started_at,
    completed_at: t.completed_at
  }))

  const noteId = notaActual?.id || null
  const insertData = { snapshot, saved_by: sesionActual.user.id }
  if (noteId) insertData.note_id = noteId

  const { error } = await db.from('todos_versions').insert(insertData)
  if (error) return alert('Error saving version.')
  alert('Version saved.')
}

async function verVersionesTodos() {
  let query = db.from('todos_versions').select('*').order('saved_at', { ascending: false })
  if (notaActual?.id) query = query.eq('note_id', notaActual.id)

  const { data } = await query
  if (!data?.length) return alert('No saved versions.')

  const lista = data.map((v, i) => `${i + 1}. ${formatearFecha(v.saved_at)}`).join('\n')
  const sel = prompt(`Saved versions:\n${lista}\n\nEnter number to restore:`)
  if (!sel) return

  const idx = parseInt(sel) - 1
  if (isNaN(idx) || !data[idx]) return alert('Invalid number.')
  if (!confirm('Restore this version? Current tasks will be replaced.')) return

  if (notaActual?.id) {
    await db.from('todos').delete().eq('note_id', notaActual.id)
  }

  const restores = data[idx].snapshot.map(t => ({
    note_id: notaActual?.id || null,
    text_enc: cifrar(t.text),
    status: t.status,
    kanban_column_id: t.kanban_column_id,
    sort_order: t.sort_order,
    started_at: t.started_at,
    completed_at: t.completed_at,
    created_by: sesionActual.user.id
  }))

  await db.from('todos').insert(restores)
  if (notaActual) await cargarTodos()
  else await cargarTodosGlobal()
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