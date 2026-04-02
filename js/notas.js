let notaActual = null
let libretaActual = null
let sesionActual = null
let historialSesion = []

async function iniciarNotas(sesion) {
  sesionActual = sesion
  await cargarLibretas()
  await cargarTodosSummary()
  await cargarPapeleraCuenta()
  iniciarBusqueda()
}

// ==================== LIBRETAS ====================

async function cargarLibretas() {
  const { data, error } = await db
    .from('notebooks')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return console.error(error)

  const lista = document.getElementById('libretas-list')
  lista.innerHTML = ''

  if (!data.length) {
    lista.innerHTML = '<li class="libreta-item loading">No notebooks yet.</li>'
    return
  }

  data.forEach(libreta => {
    const li = document.createElement('li')
    li.className = 'libreta-item'
    li.dataset.id = libreta.id
    li.innerHTML = `
      <div class="libreta-dot"></div>
      <span class="libreta-name">${descifrar(libreta.name_enc)}</span>
    `
    li.onclick = () => seleccionarLibreta(libreta, li)
    lista.appendChild(li)
  })
}

async function nuevaLibreta() {
  const nombre = prompt('Notebook name:')
  if (!nombre) return

  const { error } = await db.from('notebooks').insert({
    owner_id: sesionActual.user.id,
    name_enc: cifrar(nombre),
    is_private: true
  })

  if (error) return alert('Error creating notebook.')
  await cargarLibretas()
}

function seleccionarLibreta(libreta, el) {
  document.querySelectorAll('.libreta-item').forEach(i => i.classList.remove('active'))
  el.classList.add('active')
  libretaActual = libreta
  document.getElementById('libreta-nombre').textContent = descifrar(libreta.name_enc)

  // Mobile: ir a vista de notas
  if (window.innerWidth <= 768) {
    mobileNavSelect('notas')
  }

  cargarNotas(libreta.id)
}

// ==================== TODOS SUMMARY ====================

async function cargarTodosSummary() {
  const { data: cols } = await db
    .from('kanban_columns')
    .select('id, title, note_id')

  const { data: todos } = await db
    .from('todos')
    .select('id, status, kanban_column_id')
    .eq('note_id', notaActual?.id || '00000000-0000-0000-0000-000000000000')

  // Para el summary global tomamos todos los todos del usuario
  const { data: allTodos } = await db
    .from('todos')
    .select('id, status, kanban_column_id, note_id')

  const { data: allCols } = await db
    .from('kanban_columns')
    .select('id, title, note_id')
    .order('sort_order')

  if (!allTodos || !allCols) return

  const total = allTodos.length
  const pendientes = allTodos.filter(t => t.status !== 'done').length

  const badge = document.getElementById('todos-total-badge')
  if (badge) {
    badge.textContent = `${pendientes} pending`
    badge.className = 'todos-summary-total' + (pendientes > 0 ? ' warn' : '')
  }

  // Agrupar por columna única (por título)
  const colMap = {}
  allCols.forEach(col => {
    if (!colMap[col.title]) colMap[col.title] = { title: col.title, ids: [], count: 0 }
    colMap[col.title].ids.push(col.id)
  })

  allTodos.forEach(todo => {
    Object.values(colMap).forEach(col => {
      if (col.ids.includes(todo.kanban_column_id)) col.count++
    })
  })

  const colColors = ['#ff9f0a', '#0071e3', '#34c759', '#af52de', '#ff3b30', '#5ac8fa']
  const colsList = document.getElementById('todos-cols-list')
  if (!colsList) return

  colsList.innerHTML = ''

  const uniqueCols = Object.values(colMap)
  if (!uniqueCols.length) {
    colsList.innerHTML = '<div style="padding:8px 10px;font-size:11px;color:var(--text3);text-align:center;">No tasks yet.</div>'
    return
  }

  uniqueCols.forEach((col, i) => {
    const row = document.createElement('div')
    row.className = 'todos-col-row'
    row.innerHTML = `
      <div class="todos-col-dot" style="background:${colColors[i % colColors.length]};"></div>
      <span class="todos-col-name">${col.title}</span>
      <span class="todos-col-count">${col.count}</span>
    `
    row.onclick = () => abrirTodosGlobal()
    colsList.appendChild(row)
  })
}

async function abrirTodosGlobal() {
  // Abrir el panel de todos sin nota seleccionada
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

  // Cargar todos globales
  await cargarTodosGlobal()
  renderTodos()
}

async function cargarTodosGlobal() {
  const { data: cols } = await db
    .from('kanban_columns')
    .select('*')
    .order('sort_order')

  kanbanColumns = cols || []

  const { data: todos } = await db
    .from('todos')
    .select('*')
    .order('sort_order')

  todosList = todos || []
}

// ==================== PAPELERA ====================

async function cargarPapeleraCuenta() {
  const { data } = await db
    .from('trash')
    .select('id')

  const count = data?.length || 0
  const el = document.getElementById('papelera-count')
  if (el) el.textContent = count
}

function abrirPapelera() {
  alert('Papelera — próximamente.')
}

// ==================== NOTAS ====================

async function cargarNotas(notebook_id, orden = 'updated_at') {
  const { data, error } = await db
    .from('notes')
    .select('*')
    .eq('notebook_id', notebook_id)
    .order('is_pinned', { ascending: false })
    .order(orden, { ascending: false })

  if (error) return console.error(error)

  const lista = document.getElementById('notas-list')
  lista.innerHTML = ''

  if (!data.length) {
    lista.innerHTML = '<li class="nota-empty">No notes in this notebook.</li>'
    return
  }

  data.forEach(nota => {
    const li = document.createElement('li')
    li.className = 'nota-item'
    li.dataset.id = nota.id
    li.innerHTML = `
      <div class="nota-item-titulo">
        ${nota.is_pinned ? '<span class="nota-pin">📌</span>' : ''}
        ${descifrar(nota.title_enc) || 'Untitled'}
      </div>
      <div class="nota-item-preview">
        ${descifrar(nota.content_enc)?.replace(/<[^>]+>/g, '').substring(0, 60) || '...'}
      </div>
      <div class="nota-item-fecha">${formatearFecha(nota.updated_at)}</div>
    `
    li.onclick = () => abrirNota(nota, li)
    lista.appendChild(li)
  })
}

async function nuevaNota() {
  if (!libretaActual) return alert('Select a notebook first.')

  const { data, error } = await db.from('notes').insert({
    notebook_id: libretaActual.id,
    author_id: sesionActual.user.id,
    title_enc: cifrar('New note'),
    content_enc: cifrar(''),
    is_pinned: false
  }).select().single()

  if (error) return alert('Error creating note.')
  await cargarNotas(libretaActual.id)
  abrirNota(data)
}

function abrirNota(nota, el) {
  document.querySelectorAll('.nota-item').forEach(i => i.classList.remove('active'))
  if (el) el.classList.add('active')

  notaActual = nota
  historialSesion = []
  window._hayaCambios = false

  document.getElementById('editor-placeholder').style.display = 'none'
  document.getElementById('editor-contenido').style.display = 'flex'

  document.getElementById('nota-titulo').value = descifrar(nota.title_enc) || ''
  document.getElementById('nota-contenido').innerHTML = descifrar(nota.content_enc) || ''
  document.getElementById('nota-fecha').textContent = 'Modified: ' + formatearFecha(nota.updated_at)
  document.getElementById('btn-pin').style.opacity = nota.is_pinned ? '1' : '0.4'

  historialSesion.push(document.getElementById('nota-contenido').innerHTML)

  // Mobile: ir a vista editor
  if (window.innerWidth <= 768) mobileNavSelect('editor')

  // Autoguardado cada 5 minutos
  if (window._autoguardadoInterval) clearInterval(window._autoguardadoInterval)
  window._autoguardadoInterval = setInterval(async () => {
    if (!notaActual || !window._hayaCambios) return
    await guardarNota()
    window._hayaCambios = false
  }, 5 * 60 * 1000)
}

async function guardarNota() {
  if (!notaActual) return

  const titulo = document.getElementById('nota-titulo').value
  const contenido = document.getElementById('nota-contenido').innerHTML

  const { error } = await db.from('notes').update({
    title_enc: cifrar(titulo),
    content_enc: cifrar(contenido),
    updated_at: new Date().toISOString()
  }).eq('id', notaActual.id)

  if (error) return alert('Error saving note.')

  window._hayaCambios = false
  await registrarActividad('saved note')
  await cargarNotas(libretaActual.id)
  document.getElementById('nota-fecha').textContent = 'Modified: ' + formatearFecha(new Date())
}

async function eliminarNota() {
  if (!notaActual) return
  if (!confirm('Move this note to trash?')) return

  await db.from('trash').insert({
    note_id: notaActual.id,
    deleted_by: sesionActual.user.id
  })

  await db.from('notes').delete().eq('id', notaActual.id)

  if (window._autoguardadoInterval) clearInterval(window._autoguardadoInterval)
  window._hayaCambios = false
  notaActual = null

  document.getElementById('editor-placeholder').style.display = 'flex'
  document.getElementById('editor-contenido').style.display = 'none'

  if (typeof cerrarTodos === 'function') cerrarTodos()

  await cargarNotas(libretaActual.id)
  await cargarPapeleraCuenta()
}

async function togglePin() {
  if (!notaActual) return
  const nuevoEstado = !notaActual.is_pinned
  await db.from('notes').update({ is_pinned: nuevoEstado }).eq('id', notaActual.id)
  notaActual.is_pinned = nuevoEstado
  document.getElementById('btn-pin').style.opacity = nuevoEstado ? '1' : '0.4'
  await cargarNotas(libretaActual.id)
}

function ordenarNotas(valor) {
  if (libretaActual) cargarNotas(libretaActual.id, valor)
}

// ==================== EDITOR ====================

function formatear(comando) {
  document.execCommand(comando, false, null)
  document.getElementById('nota-contenido').focus()
}

function formatearBloque(tag) {
  document.execCommand('formatBlock', false, tag)
  document.getElementById('nota-contenido').focus()
}

function highlight(color) {
  const sel = window.getSelection()
  if (!sel.rangeCount || sel.isCollapsed) return
  const range = sel.getRangeAt(0)
  const mark = document.createElement('mark')
  mark.className = color === 'yellow' ? 'hl-yellow' : 'hl-pink'
  try { range.surroundContents(mark) } catch(e) { console.warn('Could not highlight.') }
  sel.removeAllRanges()
}

function atajosTeclado(e) {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'b') { e.preventDefault(); formatear('bold') }
    if (e.key === 'i') { e.preventDefault(); formatear('italic') }
    if (e.key === 'u') { e.preventDefault(); formatear('underline') }
    if (e.key === 's') { e.preventDefault(); guardarNota() }
    if (e.key === 'z') { e.preventDefault(); deshacer() }
  }
}

function onContenidoChange() {
  window._hayaCambios = true
  const contenido = document.getElementById('nota-contenido').innerHTML
  historialSesion.push(contenido)
  if (historialSesion.length > 100) historialSesion.shift()
}

function deshacer() {
  if (historialSesion.length < 2) return
  historialSesion.pop()
  document.getElementById('nota-contenido').innerHTML = historialSesion[historialSesion.length - 1]
}

// ==================== VERSIONES ====================

async function guardarVersion() {
  if (!notaActual) return
  const titulo = document.getElementById('nota-titulo').value
  const contenido = document.getElementById('nota-contenido').innerHTML

  const { error } = await db.from('note_versions').insert({
    note_id: notaActual.id,
    title_enc: cifrar(titulo),
    content_enc: cifrar(contenido),
    edited_by: sesionActual.user.id
  })

  if (error) return alert('Error saving version.')
  alert('Version saved successfully.')
}

async function verVersiones() {
  if (!notaActual) return
  const { data } = await db
    .from('note_versions')
    .select('*')
    .eq('note_id', notaActual.id)
    .order('saved_at', { ascending: false })

  if (!data?.length) return alert('No saved versions for this note.')

  const lista = data.map((v, i) => `${i + 1}. ${formatearFecha(v.saved_at)}`).join('\n')
  const seleccion = prompt(`Available versions:\n${lista}\n\nEnter number to restore:`)
  if (!seleccion) return

  const idx = parseInt(seleccion) - 1
  if (isNaN(idx) || !data[idx]) return alert('Invalid number.')

  document.getElementById('nota-titulo').value = descifrar(data[idx].title_enc)
  document.getElementById('nota-contenido').innerHTML = descifrar(data[idx].content_enc)
  window._hayaCambios = true
  alert('Version restored. Save the note to confirm.')
}

// ==================== ACTIVIDAD ====================

async function registrarActividad(accion) {
  if (!notaActual) return
  await db.from('note_activity').insert({
    note_id: notaActual.id,
    user_id: sesionActual.user.id,
    action: accion
  })
}

// ==================== BUSQUEDA ====================

function iniciarBusqueda() {
  const input = document.getElementById('buscar-notas')
  if (!input) return
  input.addEventListener('input', () => {
    const termino = input.value.toLowerCase()
    document.querySelectorAll('.nota-item').forEach(el => {
      const titulo = el.querySelector('.nota-item-titulo')?.textContent.toLowerCase() || ''
      const preview = el.querySelector('.nota-item-preview')?.textContent.toLowerCase() || ''
      el.style.display = titulo.includes(termino) || preview.includes(termino) ? '' : 'none'
    })
  })
}

async function buscarGlobal(termino) {
  if (!termino) return
  // Buscar en todas las notas
  const { data } = await db
    .from('notes')
    .select('id, title_enc, content_enc, notebook_id, updated_at')

  if (!data) return

  const resultados = data.filter(n => {
    const titulo = descifrar(n.title_enc).toLowerCase()
    const contenido = descifrar(n.content_enc).replace(/<[^>]+>/g, '').toLowerCase()
    return titulo.includes(termino.toLowerCase()) || contenido.includes(termino.toLowerCase())
  })

  const lista = document.getElementById('notas-list')
  lista.innerHTML = ''

  if (!resultados.length) {
    lista.innerHTML = '<li class="nota-empty">No results found.</li>'
    document.getElementById('libreta-nombre').textContent = `Results for "${termino}"`
    return
  }

  document.getElementById('libreta-nombre').textContent = `Results for "${termino}" (${resultados.length})`

  resultados.forEach(nota => {
    const li = document.createElement('li')
    li.className = 'nota-item'
    li.dataset.id = nota.id
    li.innerHTML = `
      <div class="nota-item-titulo">${descifrar(nota.title_enc) || 'Untitled'}</div>
      <div class="nota-item-preview">${descifrar(nota.content_enc)?.replace(/<[^>]+>/g, '').substring(0, 60) || '...'}</div>
      <div class="nota-item-fecha">${formatearFecha(nota.updated_at)}</div>
    `
    li.onclick = () => abrirNota(nota, li)
    lista.appendChild(li)
  })
}

// ==================== ENCRIPTACION ====================

function cifrar(texto) {
  if (!texto) return ''
  return btoa(unescape(encodeURIComponent(texto)))
}

function descifrar(texto) {
  if (!texto) return ''
  try { return decodeURIComponent(escape(atob(texto))) } catch { return texto }
}

// ==================== UTILIDADES ====================

function formatearFecha(fecha) {
  if (!fecha) return ''
  return new Date(fecha).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// ==================== MODULOS ====================

function abrirAdjuntos() { alert('Attachments module — coming soon.') }
function abrirTodos() { iniciarTodos() }
function abrirRecordatorio() { alert('Reminder module — coming soon.') }
function abrirColor() { alert('Color picker — coming soon.') }