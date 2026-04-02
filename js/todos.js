let todosPanel = null
let todosMode = 'list'
let kanbanColumns = []
let todosList = []
let draggedTodo = null
let draggedColumn = null

// ==================== INICIAR ====================

async function iniciarTodos() {
  if (!notaActual) {
    alert('Please select a note first.')
    return
  }

  todosPanel = document.getElementById('todos-panel')

  if (!todosPanel) {
    console.error('todos-panel element not found')
    return
  }

  const visible = todosPanel.style.display === 'flex'

  if (visible) {
    cerrarTodos()
    return
  }

  todosPanel.style.display = 'flex'
  document.querySelector('.notas-layout').style.gridTemplateColumns = '220px 280px 1fr 300px'

  await cargarTodos()
  renderTodos()
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
  const pendientes = todosList.filter(t => t.status !== 'done')
  const hechos = todosList.filter(t => t.status === 'done')
  const todos = [...pendientes, ...hechos]

  body.innerHTML = todos.length ? '' : '<p style="color:var(--text3);font-size:13px;text-align:center;padding:1rem;">No tasks yet.</p>'

  todos.forEach(todo => {
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
        style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;padding:2px 4px;">✕</button>
    `
    div.addEventListener('dragstart', () => draggedTodo = todo.id)
    div.addEventListener('dragover', e => e.preventDefault())
    div.addEventListener('drop', () => reordenarTodo(todo.id))
    body.appendChild(div)
  })
}

// ---- KANBAN ----
function renderKanban() {
  const body = document.getElementById('todos-body')
  body.innerHTML = ''
  body.style.padding = '10px'
  body.style.display = 'grid'
  body.style.gridTemplateColumns = `repeat(${kanbanColumns.length}, minmax(140px, 1fr))`
  body.style.gap = '8px'
  body.style.overflowX = 'auto'

  kanbanColumns.forEach(col => {
    const items = todosList.filter(t => t.kanban_column_id === col.id)
    const esOwner = notaActual.author_id === sesionActual.user.id

    const colDiv = document.createElement('div')
    colDiv.className = 'kanban-col'
    colDiv.dataset.colId = col.id
    colDiv.addEventListener('dragover', e => e.preventDefault())
    colDiv.addEventListener('drop', () => moverAColumna(col.id))

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
      const card = document.createElement('div')
      card.className = 'kanban-card'
      card.draggable = true
      card.dataset.id = todo.id
      card.innerHTML = `
        <div class="kanban-card-text">${descifrar(todo.text_enc)}</div>
        ${todo.due_date ? `<div class="kanban-card-date">${formatearFecha(todo.due_date)}</div>` : ''}
      `
      card.addEventListener('dragstart', () => draggedTodo = todo.id)
      card.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation() })
      card.addEventListener('drop', e => { e.stopPropagation(); reordenarEnColumna(todo.id, col.id) })
      card.addEventListener('click', () => abrirTodoCard(todo, card))
      colDiv.appendChild(card)
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
  await db.from('todos').update({ text_enc: cifrar(texto) }).eq('id', id)
  const todo = todosList.find(t => t.id === id)
  if (todo) todo.text_enc = cifrar(texto)
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

async function reordenarTodo(targetId) {
  if (!draggedTodo || draggedTodo === targetId) return
  const fromIdx = todosList.findIndex(t => t.id === draggedTodo)
  const toIdx = todosList.findIndex(t => t.id === targetId)
  const [moved] = todosList.splice(fromIdx, 1)
  todosList.splice(toIdx, 0, moved)
  todosList.forEach((t, i) => t.sort_order = i)
  await Promise.all(todosList.map(t => db.from('todos').update({ sort_order: t.sort_order }).eq('id', t.id)))
  renderTodos()
  draggedTodo = null
}

// ==================== ACCIONES KANBAN ====================

async function moverAColumna(colId) {
  if (!draggedTodo) return
  await db.from('todos').update({ kanban_column_id: colId }).eq('id', draggedTodo)
  const todo = todosList.find(t => t.id === draggedTodo)
  if (todo) todo.kanban_column_id = colId
  draggedTodo = null
  renderTodos()
}

async function reordenarEnColumna(targetId, colId) {
  if (!draggedTodo || draggedTodo === targetId) return
  await db.from('todos').update({ kanban_column_id: colId }).eq('id', draggedTodo)
  const todo = todosList.find(t => t.id === draggedTodo)
  if (todo) todo.kanban_column_id = colId
  draggedTodo = null
  renderTodos()
}

async function agregarTodoEnColumna(colId) {
  const texto = prompt('Task name:')
  if (!texto) return

  const { data } = await db.from('todos').insert({
    note_id: notaActual.id,
    text_enc: cifrar(texto),
    status: 'pending',
    kanban_column_id: colId,
    sort_order: todosList.filter(t => t.kanban_column_id === colId).length,
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
  await db.from('kanban_columns').update({ title: titulo }).eq('id', id)
  const col = kanbanColumns.find(c => c.id === id)
  if (col) col.title = titulo
}

async function eliminarColumna(id) {
  if (kanbanColumns.length <= 1) return alert('You need at least one column.')
  if (!confirm('Delete this column? Tasks will move to the first column.')) return

  const primeraCol = kanbanColumns[0].id
  await db.from('todos').update({ kanban_column_id: primeraCol }).eq('kanban_column_id', id)
  await db.from('kanban_columns').delete().eq('id', id)
  kanbanColumns = kanbanColumns.filter(c => c.id !== id)
  todosList.forEach(t => { if (t.kanban_column_id === id) t.kanban_column_id = primeraCol })
  renderTodos()
}

// ==================== CARD EXPANDIDA ====================

function abrirTodoCard(todo, cardEl) {
  document.querySelectorAll('.kanban-card.expanded').forEach(c => c.classList.remove('expanded'))
  cardEl.classList.add('expanded')
  cardEl.innerHTML = `
    <div contenteditable="true" class="kanban-card-edit"
      onblur="actualizarTextoTodo('${todo.id}', this.textContent)">
      ${descifrar(todo.text_enc)}
    </div>
    <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
      <select onchange="cambiarStatusTodo('${todo.id}', this.value)"
        style="font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font);">
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

async function cambiarStatusTodo(todoId, colId) {
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

  await db.from('todos_versions').insert({
    note_id: notaActual.id,
    snapshot: snapshot,
    saved_by: sesionActual.user.id
  })

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

  const version = data[idx]
  if (!confirm('Restore this version? Current tasks will be replaced.')) return

  await db.from('todos').delete().eq('note_id', notaActual.id)

  const restores = version.snapshot.map(t => ({
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
  const body = document.getElementById('todos-body')
  body.style.display = mode === 'list' ? 'block' : 'grid'
  renderTodos()
}