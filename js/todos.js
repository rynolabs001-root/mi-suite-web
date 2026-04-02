let todosPanel = null
let todosMode = 'list'
let kanbanColumns = []
let todosList = []
let draggedTodo = null

// ==================== INICIAR ====================

async function iniciarTodos() {
  if (!notaActual) {
    alert('Please select a note first.')
    return
  }

  todosPanel = document.getElementById('todos-panel')
  if (!todosPanel) return

  const visible = todosPanel.style.display === 'flex'

  if (visible) {
    cerrarTodos()
    return
  }

  const resizer3 = document.getElementById('resizer-3')
  const editor = document.getElementById('editor-panel')

  todosPanel.style.display = 'flex'
  todosPanel.style.flex = '1'
  todosPanel.style.width = 'auto'
  todosPanel.style.minWidth = '250px'
  todosPanel.style.maxWidth = 'none'

  if (resizer3) resizer3.style.display = 'block'

  if (editor) {
    editor.style.flex = '1'
    editor.style.minWidth = '300px'
  }

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

// ---- LISTA ----
function renderLista() {
  const body = document.getElementById('todos-body')
  body.style.display = 'block'
  body.style.overflowY = 'auto'
  body.style.overflowX = 'hidden'
  body.style.padding = '10px'

  const pendientes = todosList.filter(t => t.status !== 'done')
  const hechos = todosList.filter(t => t.status === 'done')
  const todos = [...pendientes, ...hechos]

  body.innerHTML = todos.length ? '' : '<p style="color:var(--text3);font-size:13px;text-align:center;padding:1rem;">No tasks yet.</p>'

  todos.forEach(todo => {
    const div = crearTodoItem(todo)
    body.appendChild(div)
  })

  body.addEventListener('dragover', e => {
    e.preventDefault()
    const afterEl = getDragAfterElement(body, e.clientY, '.todo-item')
    limpiarIndicadores(body)
    const indicator = crearIndicador()
    if (!afterEl) {
      body.appendChild(indicator)
    } else {
      body.insertBefore(indicator, afterEl)
    }
  })

  body.addEventListener('drop', e => {
    e.preventDefault()
    limpiarIndicadores(body)
    if (!draggedTodo) return
    const afterEl = getDragAfterElement(body, e.clientY, '.todo-item')
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
      ${todo.due_date ? `<div class="todo-date">${formatearFecha(todo.due_date)}</div>` : ''}
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
    limpiarIndicadores(document.getElementById('todos-body'))
  })

  return div
}

// ---- KANBAN ----
function renderKanban() {
  const body = document.getElementById('todos-body')
  body.style.display = 'flex'
  body.style.gap = '8px'
  body.style.overflowX = 'auto'
  body.style.overflowY = 'hidden'
  body.style.alignItems = 'flex-start'
  body.style.padding = '10px'
  body.innerHTML = ''

  kanbanColumns.forEach(col => {
    const items = todosList
      .filter(t => t.kanban_column_id === col.id)
      .sort((a, b) => a.sort_order - b.sort_order)

    const esOwner = notaActual.author_id === sesionActual.user.id
    const colDiv = document.createElement('div')
    colDiv.className = 'kanban-col'
    colDiv.dataset.colId = col.id
    colDiv.style.minWidth = '150px'
    colDiv.style.flex = '1'

    colDiv.innerHTML = `
      <div class="kanban-col-header">
        <span class="kanban-col-title"
          contenteditable="${esOwner}"
          onblur="renombrarColumna('${col.id}', this.textContent)">
          ${col.title}
        </span>
        <span class="kanban-col-count">${items.length}</span>
        ${esOwner ? `<button class="kanban-col-delete" onclick="eliminarColumna('${col.id}')">✕</button>` : ''}
      </div>
    `

    items.forEach(todo => {
      const card = crearKanbanCard(todo, col.id)
      colDiv.appendChild(card)
    })

    colDiv.addEventListener('dragover', e => {
      e.preventDefault()
      const afterEl = getDragAfterElement(colDiv, e.clientY, '.kanban-card')
      limpiarIndicadores(colDiv)
      const indicator = crearIndicador()
      const addBtn = colDiv.querySelector('.kanban-add-btn')
      if (!afterEl) {
        colDiv.insertBefore(indicator, addBtn)
      } else {
        colDiv.insertBefore(indicator, afterEl)
      }
    })

    colDiv.addEventListener('dragleave', e => {
      if (!colDiv.contains(e.relatedTarget)) {
        limpiarIndicadores(colDiv)
      }
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

    const addBtn = document.createElement('button')
    addBtn.className = 'kanban-add-btn'
    addBtn.textContent = '+ Add task'
    addBtn.onclick = () => agregarTodoEnColumna(col.id)
    colDiv.appendChild(addBtn)

    body.appendChild(colDiv)
  })

  if (kanbanColumns.length < 6 && notaActual.author_id === sesionActual.user.id) {
    const addCol = document.createElement('button')
    addCol.className = 'kanban-add-col'
    addCol.textContent = '+ Add column'
    addCol.onclick = agregarColumna
    body.appendChild(addCol)
  }
}

function crearKanbanCard(todo, colId) {
  const card = document.createElement('div')
  card.className = 'kanban-card'
  card.draggable = true
  card.dataset.id = todo.id
  card.innerHTML = `
    <div class="kanban-card-text">${descifrar(todo.text_enc)}</div>
    ${todo.due_date ? `<div class="kanban-card-date">${formatearFecha(todo.due_date)}</div>` : ''}
  `

  card.addEventListener('dragstart', e => {
    draggedTodo = todo.id
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => card.style.opacity = '0.4', 0)
  })

  card.addEventListener('dragend', () => {
    card.style.opacity = '1'
    draggedTodo = null
    document.querySelectorAll('.drop-indicator').forEach(el => el.remove())
  })

  card.addEventListener('click', () => abrirTodoCard(todo, card))

  return card
}

// ==================== DRAG HELPERS ====================

function getDragAfterElement(container, y, selector) {
  const elements = [...container.querySelectorAll(selector)]
    .filter(el => el.style.opacity !== '0.4')

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

// ==================== ACCIONES LISTA ====================

async function agregarTodo() {
  const input = document.getElementById('todo-input')
  const texto = input.value.trim()
  if (!texto) return

  const colDefault = kanbanColumns[0]?.id || null

  const { data } = await db.from('todos').insert({
    note_id: notaActual.id,
    text_enc: cifrar(texto),
    status: 'pending',
    kanban_column_id: colDefault,
    sort_order: todosList.length,
    created_by: sesionActual.user.id
  }).select().single()

  if (data) {
    todosList.push(data)
    input.value = ''
    renderTodos()
  }
}

async function toggleTodoStatus(id) {
  const todo = todosList.find(t => t.id === id)
  if (!todo) return
  const nuevo = todo.status === 'done' ? 'pending' : 'done'
  await db.from('todos').update({ status: nuevo }).eq('id', id)
  todo.status = nuevo
  renderTodos()
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
    note_id: notaActual.id,
    text_enc: todo.text_enc,
    status: todo.status,
    kanban_column_id: todo.kanban_column_id,
    sort_order: todo.sort_order,
    due_date: todo.due_date,
    deleted_by: sesionActual.user.id
  })

  await db.from('todos').delete().eq('id', id)
  todosList = todosList.filter(t => t.id !== id)
  renderTodos()
}

// ==================== ACCIONES KANBAN ====================

async function agregarTodoEnColumna(colId) {
  const texto = prompt('Task name:')
  if (!texto) return

  const colItems = todosList.filter(t => t.kanban_column_id === colId)

  const { data } = await db.from('todos').insert({
    note_id: notaActual.id,
    text_enc: cifrar(texto),
    status: 'pending',
    kanban_column_id: colId,
    sort_order: colItems.length,
    created_by: sesionActual.user.id
  }).select().single()

  if (data) {
    todosList.push(data)
    renderTodos()
  }
}

async function agregarColumna() {
  if (kanbanColumns.length >= 6) return alert('Maximum 6 columns allowed.')
  const titulo = prompt('Column name:')
  if (!titulo) return

  const { data } = await db.from('kanban_columns').insert({
    note_id: notaActual.id,
    title: titulo,
    sort_order: kanbanColumns.length,
    created_by: sesionActual.user.id
  }).select().single()

  if (data) {
    kanbanColumns.push(data)
    renderTodos()
  }
}

async function renombrarColumna(id, titulo) {
  const trimmed = titulo.trim()
  if (!trimmed) return
  await db.from('kanban_columns').update({ title: trimmed }).eq('id', id)
  const col = kanbanColumns.find(c => c.id === id)
  if (col) col.title = trimmed
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

// ==================== CARD EXPANDIDA ====================

function abrirTodoCard(todo, cardEl) {
  document.querySelectorAll('.kanban-card.expanded').forEach(c => {
    c.classList.remove('expanded')
    c.innerHTML = `<div class="kanban-card-text">${descifrar(c._todoText || '')}</div>`
  })

  cardEl._todoText = todo.text_enc
  cardEl.classList.add('expanded')
  cardEl.innerHTML = `
    <div contenteditable="true" class="kanban-card-edit"
      onblur="actualizarTextoTodo('${todo.id}', this.textContent)">
      ${descifrar(todo.text_enc)}
    </div>
    <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center;">
      <select onchange="cambiarColumnaKanban('${todo.id}', this.value)"
        style="font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font);flex:1;">
        ${kanbanColumns.map(c => `<option value="${c.id}" ${todo.kanban_column_id === c.id ? 'selected' : ''}>${c.title}</option>`).join('')}
      </select>
      <button onclick="eliminarTodo('${todo.id}')"
        style="font-size:11px;padding:3px 8px;border-radius:6px;border:none;background:var(--danger);color:#fff;cursor:pointer;font-family:var(--font);">
        Delete
      </button>
    </div>
  `
  cardEl.querySelector('.kanban-card-edit').focus()

  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!cardEl.contains(e.target)) {
        cardEl.classList.remove('expanded')
        cargarTodos().then(() => renderTodos())
        document.removeEventListener('click', handler)
      }
    })
  }, 100)
}

async function cambiarColumnaKanban(todoId, colId) {
  await db.from('todos').update({ kanban_column_id: colId }).eq('id', todoId)
  const todo = todosList.find(t => t.id === todoId)
  if (todo) todo.kanban_column_id = colId
}

// ==================== VERSIONES ====================

async function guardarVersionTodos() {
  const snapshot = todosList.map(t => ({
    id: t.id,
    text: descifrar(t.text_enc),
    status: t.status,
    kanban_column_id: t.kanban_column_id,
    sort_order: t.sort_order
  }))

  const { error } = await db.from('todos_versions').insert({
    note_id: notaActual.id,
    snapshot,
    saved_by: sesionActual.user.id
  })

  if (error) return alert('Error saving version.')
  alert('To-Do version saved.')
}

async function verVersionesTodos() {
  const { data } = await db
    .from('todos_versions')
    .select('*')
    .eq('note_id', notaActual.id)
    .order('saved_at', { ascending: false })

  if (!data?.length) return alert('No saved versions.')

  const lista = data.map((v, i) => `${i + 1}. ${formatearFecha(v.saved_at)}`).join('\n')
  const sel = prompt(`Saved versions:\n${lista}\n\nEnter number to restore:`)
  if (!sel) return

  const idx = parseInt(sel) - 1
  if (isNaN(idx) || !data[idx]) return alert('Invalid number.')
  if (!confirm('Restore this version? Current tasks will be replaced.')) return

  await db.from('todos').delete().eq('note_id', notaActual.id)

  const restores = data[idx].snapshot.map(t => ({
    note_id: notaActual.id,
    text_enc: cifrar(t.text),
    status: t.status,
    kanban_column_id: t.kanban_column_id,
    sort_order: t.sort_order,
    created_by: sesionActual.user.id
  }))

  await db.from('todos').insert(restores)
  await cargarTodos()
  renderTodos()
  alert('Version restored.')
}

// ==================== MODO ====================

function setTodosMode(mode) {
  todosMode = mode
  document.getElementById('tab-list').classList.toggle('active', mode === 'list')
  document.getElementById('tab-kanban').classList.toggle('active', mode === 'kanban')
  renderTodos()
}