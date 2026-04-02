let notaActual = null
let libretaActual = null
let sesionActual = null
let historialSesion = []

async function iniciarNotas(sesion) {
  sesionActual = sesion
  await cargarLibretas()
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
    lista.innerHTML = '<li class="libreta-item loading">Sin libretas aún.</li>'
    return
  }

  data.forEach(libreta => {
    const li = document.createElement('li')
    li.className = 'libreta-item'
    li.textContent = descifrar(libreta.name_enc)
    li.dataset.id = libreta.id
    li.onclick = () => seleccionarLibreta(libreta, li)
    lista.appendChild(li)
  })
}

async function nuevaLibreta() {
  const nombre = prompt('Nombre de la nueva libreta:')
  if (!nombre) return

  const { error } = await db.from('notebooks').insert({
    owner_id: sesionActual.user.id,
    name_enc: cifrar(nombre),
    is_private: true
  })

  if (error) return alert('Error al crear libreta.')
  await cargarLibretas()
}

function seleccionarLibreta(libreta, el) {
  document.querySelectorAll('.libreta-item').forEach(i => i.classList.remove('active'))
  el.classList.add('active')
  libretaActual = libreta
  document.getElementById('libreta-nombre').textContent = descifrar(libreta.name_enc)
  cargarNotas(libreta.id)
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
    lista.innerHTML = '<li class="nota-empty">Sin notas en esta libreta.</li>'
    return
  }

  data.forEach(nota => {
    const li = document.createElement('li')
    li.className = 'nota-item'
    li.dataset.id = nota.id
    li.innerHTML = `
      <div class="nota-item-titulo">
        ${nota.is_pinned ? '<span class="nota-pin">📌</span>' : ''}
        ${descifrar(nota.title_enc) || 'Sin título'}
      </div>
      <div class="nota-item-preview">${descifrar(nota.content_enc)?.replace(/<[^>]+>/g, '').substring(0, 60) || '...'}</div>
      <div class="nota-item-fecha">${formatearFecha(nota.updated_at)}</div>
    `
    li.onclick = () => abrirNota(nota, li)
    lista.appendChild(li)
  })
}

async function nuevaNota() {
  if (!libretaActual) return alert('Selecciona una libreta primero.')

  const { data, error } = await db.from('notes').insert({
    notebook_id: libretaActual.id,
    author_id: sesionActual.user.id,
    title_enc: cifrar('Nueva nota'),
    content_enc: cifrar(''),
    is_pinned: false
  }).select().single()

  if (error) return alert('Error al crear nota.')
  await cargarNotas(libretaActual.id)
  abrirNota(data)
}

function abrirNota(nota, el) {
  document.querySelectorAll('.nota-item').forEach(i => i.classList.remove('active'))
  if (el) el.classList.add('active')

  notaActual = nota
  historialSesion = []

  document.getElementById('editor-placeholder').style.display = 'none'
  document.getElementById('editor-contenido').style.display = 'flex'

  document.getElementById('nota-titulo').value = descifrar(nota.title_enc) || ''
  document.getElementById('nota-contenido').innerHTML = descifrar(nota.content_enc) || ''
  document.getElementById('nota-fecha').textContent = 'Modificado: ' + formatearFecha(nota.updated_at)
  document.getElementById('btn-pin').style.opacity = nota.is_pinned ? '1' : '0.4'
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

  if (error) return alert('Error al guardar.')

  await registrarActividad('guardó la nota')
  await cargarNotas(libretaActual.id)
  document.getElementById('nota-fecha').textContent = 'Modificado: ' + formatearFecha(new Date())
}

async function eliminarNota() {
  if (!notaActual) return
  if (!confirm('¿Mover esta nota a la papelera?')) return

  await db.from('trash').insert({
    note_id: notaActual.id,
    deleted_by: sesionActual.user.id
  })

  await db.from('notes').delete().eq('id', notaActual.id)

  notaActual = null
  document.getElementById('editor-placeholder').style.display = 'flex'
  document.getElementById('editor-contenido').style.display = 'none'
  await cargarNotas(libretaActual.id)
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
  range.surroundContents(mark)
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
  const contenido = document.getElementById('nota-contenido').innerHTML
  historialSesion.push(contenido)
  if (historialSesion.length > 50) historialSesion.shift()
}

function deshacer() {
  if (historialSesion.length < 2) return
  historialSesion.pop()
  const anterior = historialSesion[historialSesion.length - 1]
  document.getElementById('nota-contenido').innerHTML = anterior
}

// ==================== VERSIONES ====================

async function guardarVersion() {
  if (!notaActual) return
  const titulo = document.getElementById('nota-titulo').value
  const contenido = document.getElementById('nota-contenido').innerHTML

  await db.from('note_versions').insert({
    note_id: notaActual.id,
    title_enc: cifrar(titulo),
    content_enc: cifrar(contenido),
    edited_by: sesionActual.user.id
  })

  alert('Versión guardada correctamente.')
}

async function verVersiones() {
  if (!notaActual) return
  const { data } = await db
    .from('note_versions')
    .select('*')
    .eq('note_id', notaActual.id)
    .order('saved_at', { ascending: false })

  if (!data?.length) return alert('No hay versiones guardadas para esta nota.')

  const lista = data.map((v, i) =>
    `${i + 1}. ${formatearFecha(v.saved_at)}`
  ).join('\n')

  const seleccion = prompt(`Versiones disponibles:\n${lista}\n\nEscribe el número para restaurar (o cancela):`)
  if (!seleccion) return

  const idx = parseInt(seleccion) - 1
  if (isNaN(idx) || !data[idx]) return alert('Número inválido.')

  const version = data[idx]
  document.getElementById('nota-titulo').value = descifrar(version.title_enc)
  document.getElementById('nota-contenido').innerHTML = descifrar(version.content_enc)
  alert('Versión restaurada. Guarda la nota para confirmar.')
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
  input.addEventListener('input', () => {
    const termino = input.value.toLowerCase()
    document.querySelectorAll('.nota-item').forEach(el => {
      const titulo = el.querySelector('.nota-item-titulo').textContent.toLowerCase()
      const preview = el.querySelector('.nota-item-preview').textContent.toLowerCase()
      el.style.display = titulo.includes(termino) || preview.includes(termino) ? '' : 'none'
    })
  })
}

// ==================== ENCRIPTACION ====================

function cifrar(texto) {
  if (!texto) return ''
  return btoa(unescape(encodeURIComponent(texto)))
}

function descifrar(texto) {
  if (!texto) return ''
  try {
    return decodeURIComponent(escape(atob(texto)))
  } catch {
    return texto
  }
}

// ==================== UTILIDADES ====================

function formatearFecha(fecha) {
  if (!fecha) return ''
  return new Date(fecha).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function abrirAdjuntos() { alert('Módulo de adjuntos — próximamente.') }
function abrirTodos() { iniciarTodos() }
function abrirRecordatorio() { alert('Módulo de recordatorios — próximamente.') }
function abrirColor() { alert('Selector de color — próximamente.') }

/* ==================== TODOS PANEL ==================== */
.notas-layout.with-todos {
  grid-template-columns: 220px 280px 1fr 320px;
}

.todos-panel {
  background: var(--bg);
  border-left: 1px solid var(--border);
  display: none;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  min-width: 0;
}

.todos-header {
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.todos-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.todos-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-tabs {
  display: flex;
  background: var(--bg3);
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}

.mode-tab {
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  font-family: var(--font);
  border: none;
  cursor: pointer;
  color: var(--text3);
  background: transparent;
  transition: all 0.15s;
}

.mode-tab.active {
  background: var(--bg2);
  color: var(--text);
}

.todos-body {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

/* Lista */
.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 7px 10px;
  background: var(--bg2);
  border-radius: 8px;
  margin-bottom: 6px;
  border: 1px solid var(--border);
  cursor: grab;
}

.todo-item:active { cursor: grabbing; }

.todo-check {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.5px solid var(--border2);
  flex-shrink: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
  transition: all 0.15s;
}

.todo-check.done {
  background: var(--success);
  border-color: var(--success);
}

.todo-check.done::after {
  content: '✓';
  font-size: 10px;
  color: #fff;
  font-weight: 600;
}

.todo-text {
  font-size: 13px;
  color: var(--text);
  flex: 1;
  outline: none;
  line-height: 1.5;
}

.todo-text.done {
  text-decoration: line-through;
  color: var(--text3);
}

.todo-date {
  font-size: 11px;
  color: var(--warning);
  margin-top: 2px;
}

.todo-add {
  display: flex;
  gap: 6px;
  padding: 10px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.todo-input {
  flex: 1;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border2);
  font-size: 13px;
  font-family: var(--font);
  outline: none;
  background: var(--bg2);
  color: var(--text);
}

.todo-input:focus { border-color: var(--accent); }

.todo-add-btn {
  padding: 6px 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  font-family: var(--font);
}

/* Kanban */
.todos-body.kanban-mode {
  display: grid;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 10px;
  align-content: start;
}

.kanban-col {
  background: var(--bg2);
  border-radius: 10px;
  border: 1px solid var(--border);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 200px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.kanban-col-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.kanban-col-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text3);
  flex: 1;
  outline: none;
  cursor: text;
}

.kanban-col-count {
  font-size: 11px;
  font-weight: 500;
  color: var(--text3);
  background: var(--bg3);
  padding: 1px 6px;
  border-radius: 99px;
}

.kanban-col-delete {
  background: none;
  border: none;
  color: var(--text3);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.15s;
}

.kanban-col-delete:hover { color: var(--danger); }

.kanban-card {
  background: var(--bg);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--text);
  line-height: 1.5;
  border: 1px solid var(--border);
  cursor: grab;
  transition: border-color 0.15s;
}

.kanban-card:active { cursor: grabbing; }
.kanban-card:hover { border-color: var(--accent); }

.kanban-card.expanded {
  cursor: default;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(0,113,227,0.15);
}

.kanban-card-text { font-size: 12px; color: var(--text); line-height: 1.5; }
.kanban-card-date { font-size: 11px; color: var(--warning); margin-top: 4px; }

.kanban-card-edit {
  font-size: 12px;
  color: var(--text);
  line-height: 1.5;
  outline: none;
  min-height: 40px;
}

.kanban-add-btn {
  background: none;
  border: none;
  color: var(--text3);
  font-size: 12px;
  font-family: var(--font);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  text-align: left;
  transition: background 0.15s;
  margin-top: 4px;
}

.kanban-add-btn:hover { background: var(--bg3); color: var(--text); }

.kanban-add-col {
  background: var(--bg2);
  border: 1.5px dashed var(--border2);
  border-radius: 10px;
  padding: 12px;
  font-size: 12px;
  font-family: var(--font);
  color: var(--text3);
  cursor: pointer;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.kanban-add-col:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--bg3);
}