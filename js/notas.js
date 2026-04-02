let notaActual = null
let libretaActual = null
let sesionActual = null
let historialSesion = []

const NOTE_COLORS = [
  { id: 'none',   bg: null,      label: 'Default' },
  { id: 'yellow', bg: '#fcd34d', label: 'Yellow'  },
  { id: 'blue',   bg: '#60a5fa', label: 'Blue'    },
  { id: 'green',  bg: '#4ade80', label: 'Green'   },
  { id: 'pink',   bg: '#f472b6', label: 'Pink'    },
  { id: 'purple', bg: '#c084fc', label: 'Purple'  },
  { id: 'orange', bg: '#fb923c', label: 'Orange'  },
  { id: 'gray',   bg: '#cbd5e1', label: 'Gray'    },
]

async function iniciarNotas(sesion) {
  sesionActual = sesion
  iniciarColorPickerEditor()
  await cargarLibretas()
  await cargarTodosSummary()
  await cargarPapeleraCuenta()
  iniciarBusqueda()
}

// ==================== COLOR PICKER ====================

function iniciarColorPickerEditor() {
  renderColorSwatches('color-swatches-editor', color => aplicarColorNota(color))
}

function renderColorSwatches(containerId, onSelect, currentColorId) {
  const container = document.getElementById(containerId)
  if (!container) return
  container.innerHTML = ''
  NOTE_COLORS.forEach(color => {
    const div = document.createElement('div')
    div.className = 'color-swatch' + (color.id === currentColorId ? ' selected' : '')
    div.title = color.label
    div.dataset.colorId = color.id
    div.style.background = color.bg || '#ffffff'
    if (!color.bg) div.style.border = '1.5px solid var(--border2)'
    div.onclick = e => { e.stopPropagation(); onSelect(color) }
    container.appendChild(div)
  })
}

function toggleColorPickerEditor() {
  const popup = document.getElementById('color-picker-editor')
  if (!popup) return
  const isOpen = popup.classList.contains('open')
  cerrarTodosLosColorPickers()
  if (!isOpen) {
    popup.classList.add('open')
    actualizarSwatchesSeleccionados('color-swatches-editor', notaActual?.color_id || 'none')
    setTimeout(() => document.addEventListener('click', cerrarColorPickerFueraEditor), 100)
  }
}

function cerrarColorPickerFueraEditor(e) {
  const popup = document.getElementById('color-picker-editor')
  const btn = document.getElementById('btn-color')
  if (popup && !popup.contains(e.target) && e.target !== btn) {
    popup.classList.remove('open')
    document.removeEventListener('click', cerrarColorPickerFueraEditor)
  }
}

function cerrarTodosLosColorPickers() {
  document.querySelectorAll('.color-picker-popup').forEach(p => p.classList.remove('open'))
  document.querySelectorAll('.nota-color-inline').forEach(p => p.classList.remove('open'))
  document.removeEventListener('click', cerrarColorPickerFueraEditor)
}

function actualizarSwatchesSeleccionados(containerId, colorId) {
  const container = document.getElementById(containerId)
  if (!container) return
  container.querySelectorAll('.color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.colorId === colorId)
  })
}

async function aplicarColorNota(color) {
  if (!notaActual) return
  const { error } = await db.from('notes').update({ color_id: color.id }).eq('id', notaActual.id)
  if (error) return console.error(error)
  notaActual.color_id = color.id
  aplicarColorEditor(color.bg)
  cerrarTodosLosColorPickers()
  if (libretaActual) await cargarNotas(libretaActual.id)
}

async function aplicarColorNotaById(notaId, color) {
  const { error } = await db.from('notes')
    .update({ color_id: color.id })
    .eq('id', notaId)

  if (error) return console.error(error)

  // Update in-memory nota if it's the active one
  if (notaActual?.id === notaId) {
    notaActual.color_id = color.id
    aplicarColorEditor(color.bg)
  }

  cerrarTodosLosColorPickers()

  // Update the nota item in the list immediately without full reload
  const li = document.querySelector(`.nota-item[data-id="${notaId}"]`)
  if (li) {
    if (color.bg) {
      li.style.background = color.bg
    } else {
      li.style.background = ''
    }
    // Update color btn state
    const colorBtn = li.querySelector('.nota-color-btn')
    if (colorBtn) colorBtn.classList.toggle('colored', !!color.bg)
    // Update inline swatch selection
    li.querySelectorAll('.nota-color-inline .color-swatch').forEach(s => {
      s.classList.toggle('selected', s.dataset.colorId === color.id)
    })
    // Close inline picker
    const inline = li.querySelector('.nota-color-inline')
    if (inline) inline.classList.remove('open')
  }

  // Full reload to persist
  if (libretaActual) await cargarNotas(libretaActual.id)
}

function aplicarColorEditor(bg) {
  const color = bg || ''
  ;['editor-contenido', 'nota-titulo', 'nota-contenido'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.style.background = color
  })
  const footer = document.querySelector('.editor-footer')
  const toolbar = document.querySelector('.editor-toolbar')
  if (footer) footer.style.background = color
  if (toolbar) toolbar.style.background = color
}

// ==================== LIBRETAS ====================

async function cargarLibretas() {
  const { data, error } = await db
    .from('notebooks')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return console.error(error)

  const lista = document.getElementById('libretas-list')
  const badge = document.getElementById('libretas-count')
  lista.innerHTML = ''
  if (badge) badge.textContent = data.length

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
  if (typeof esMobile === 'function' && esMobile()) mobileNavSelect('notas')
  cargarNotas(libreta.id)
}

// ==================== TODOS SUMMARY ====================

async function cargarTodosSummary() {
  const { data: allTodos } = await db.from('todos').select('id, status, kanban_column_id')
  const { data: allCols } = await db.from('kanban_columns').select('id, title').order('sort_order')

  if (!allTodos || !allCols) return

  const pendientes = allTodos.filter(t => t.status === 'pending').length
  const done = allTodos.filter(t => t.status === 'done').length
  const total = allTodos.length

  // To-Do badges
  const todoBadge = document.getElementById('todos-total-badge')
  if (todoBadge) {
    todoBadge.textContent = `${pendientes} pending`
    todoBadge.className = 'sidebar-section-badge' + (pendientes > 0 ? ' warn' : '')
  }

  const pendingEl = document.getElementById('todos-pending-count')
  const doneEl = document.getElementById('todos-done-count')
  if (pendingEl) pendingEl.textContent = pendientes
  if (doneEl) doneEl.textContent = done

  // Kanban summary — exclude source and closed
  const kanbanSummary = document.getElementById('kanban-cols-summary')
  if (!kanbanSummary) return
  kanbanSummary.innerHTML = ''

  const EXCLUDED = ['To Do', "To-Do's", 'Closed']
  const seenTitles = new Set()
  let kanbanTotal = 0
  const colColors = ['#0071e3', '#af52de', '#ff9f0a', '#ff3b30', '#5ac8fa']

  const kanbanCols = allCols.filter(col => {
    if (EXCLUDED.includes(col.title)) return false
    if (seenTitles.has(col.title)) return false
    seenTitles.add(col.title)
    return true
  })

  kanbanCols.forEach((col, i) => {
    const count = allTodos.filter(t => t.kanban_column_id === col.id).length
    kanbanTotal += count

    const row = document.createElement('div')
    row.className = 'summary-row'
    row.innerHTML = `
      <div class="summary-dot" style="background:${colColors[i % colColors.length]};"></div>
      <span class="summary-name">${col.title}</span>
      <span class="summary-count">${count}</span>
    `
    kanbanSummary.appendChild(row)
  })

  if (!kanbanCols.length) {
    kanbanSummary.innerHTML = '<div style="padding:8px 10px;font-size:11px;color:var(--text3);text-align:center;">No columns yet.</div>'
  }

  const kanbanBadge = document.getElementById('kanban-total-badge')
  if (kanbanBadge) kanbanBadge.textContent = `${kanbanTotal} cards`

  if (typeof patchTodosSidebar === 'function') setTimeout(patchTodosSidebar, 100)
}

async function abrirTodosGlobal() {
  if (typeof esMobile === 'function' && esMobile()) { mobileNavSelect('todos'); return }

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

async function abrirTodosGlobalModo(modo) {
  if (typeof esMobile === 'function' && esMobile()) { mobileNavSelect('todos'); return }
  await abrirTodosGlobal()
  if (typeof setTodosMode === 'function') setTimeout(() => setTodosMode(modo), 150)
}

// ==================== PAPELERA ====================

async function cargarPapeleraCuenta() {
  const { data } = await db.from('trash').select('id')
  const count = data?.length || 0
  const el = document.getElementById('papelera-count')
  if (el) el.textContent = count
}

function abrirPapelera() {
  if (typeof esMobile === 'function' && esMobile()) { mobileNavSelect('papelera'); return }
  alert('Trash — coming soon.')
}

// ==================== NOTAS ====================

async function cargarNotas(notebook_id, orden = 'updated_at') {
  let query = db.from('notes').select('*').eq('notebook_id', notebook_id)

  if (orden === 'sort_order') {
    query = query.order('is_pinned', { ascending: false }).order('sort_order', { ascending: true })
  } else {
    query = query.order('is_pinned', { ascending: false }).order(orden, { ascending: false })
  }

  const { data, error } = await query
  if (error) return console.error(error)

  const lista = document.getElementById('notas-list')
  lista.innerHTML = ''

  if (!data.length) {
    lista.innerHTML = '<li class="nota-empty">No notes in this notebook.</li>'
    return
  }

  data.forEach((nota, index) => {
    const colorObj = NOTE_COLORS.find(c => c.id === nota.color_id)
    const bgColor = colorObj?.bg || ''

    const li = document.createElement('li')
    li.className = 'nota-item'
    li.dataset.id = nota.id
    li.dataset.sortOrder = nota.sort_order ?? index
    if (bgColor) li.style.background = bgColor

    li.innerHTML = `
      <div class="nota-item-header">
        <div class="nota-item-titulo">${descifrar(nota.title_enc) || 'Untitled'}</div>
        <div class="nota-item-actions">
          <button class="nota-pin-btn ${nota.is_pinned ? 'pinned' : ''}"
            onclick="event.stopPropagation(); togglePinNota('${nota.id}')"
            title="${nota.is_pinned ? 'Unpin' : 'Pin note'}">📌</button>
          <button class="nota-color-btn ${bgColor ? 'colored' : ''}"
            onclick="event.stopPropagation(); toggleColorInline(event, '${nota.id}')"
            title="Note color">🎨</button>
        </div>
      </div>
      <div class="nota-color-inline" id="color-inline-${nota.id}"></div>
      <div class="nota-item-preview">
        ${descifrar(nota.content_enc)?.replace(/<[^>]+>/g, '').substring(0, 60) || '...'}
      </div>
      <div class="nota-item-fecha">${formatearFecha(nota.updated_at)}</div>
    `

    // Build inline swatches
    const inlineEl = li.querySelector(`#color-inline-${nota.id}`)
    if (inlineEl) {
      NOTE_COLORS.forEach(color => {
        const swatch = document.createElement('div')
        swatch.className = 'color-swatch' + (nota.color_id === color.id ? ' selected' : '')
        swatch.dataset.colorId = color.id
        swatch.style.background = color.bg || '#ffffff'
        if (!color.bg) swatch.style.border = '1.5px solid var(--border2)'
        swatch.onclick = async e => {
          e.stopPropagation()
          await aplicarColorNotaById(nota.id, color)
        }
        inlineEl.appendChild(swatch)
      })
    }

    iniciarDragNotaItem(li, nota)
    li.onclick = () => abrirNota(nota, li)
    lista.appendChild(li)
  })
}

function toggleColorInline(e, notaId) {
  e.stopPropagation()
  const inline = document.getElementById(`color-inline-${notaId}`)
  if (!inline) return

  const isOpen = inline.classList.contains('open')

  // Close all
  document.querySelectorAll('.nota-color-inline.open').forEach(el => el.classList.remove('open'))

  if (!isOpen) inline.classList.add('open')
}

// ---- Drag & drop note reordering ----
let dragNotaId = null
let dragNotaEl = null

function iniciarDragNotaItem(el, nota) {
  el.draggable = true

  el.addEventListener('dragstart', e => {
    dragNotaId = nota.id
    dragNotaEl = el
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => el.classList.add('dragging'), 0)
  })

  el.addEventListener('dragend', () => {
    el.classList.remove('dragging')
    document.querySelectorAll('.nota-drop-indicator').forEach(i => i.remove())
    document.querySelectorAll('.nota-item.drag-over').forEach(i => i.classList.remove('drag-over'))
    dragNotaId = null
    dragNotaEl = null
  })

  el.addEventListener('dragover', e => {
    e.preventDefault()
    if (dragNotaEl === el) return
    document.querySelectorAll('.nota-drop-indicator').forEach(i => i.remove())
    document.querySelectorAll('.nota-item.drag-over').forEach(i => i.classList.remove('drag-over'))

    const rect = el.getBoundingClientRect()
    const ind = document.createElement('li')
    ind.className = 'nota-drop-indicator'

    if (e.clientY < rect.top + rect.height / 2) {
      el.parentNode.insertBefore(ind, el)
    } else {
      el.parentNode.insertBefore(ind, el.nextSibling)
    }
    el.classList.add('drag-over')
  })

  el.addEventListener('drop', async e => {
    e.preventDefault()
    if (!dragNotaId || dragNotaId === nota.id) return

    document.querySelectorAll('.nota-drop-indicator').forEach(i => i.remove())
    document.querySelectorAll('.nota-item.drag-over').forEach(i => i.classList.remove('drag-over'))

    const lista = document.getElementById('notas-list')
    const items = [...lista.querySelectorAll('.nota-item')]
    const fromEl = items.find(i => i.dataset.id === dragNotaId)
    if (!fromEl) return

    const rect = e.currentTarget.getBoundingClientRect()
    const insertBefore = e.clientY < rect.top + rect.height / 2

    if (insertBefore) lista.insertBefore(fromEl, el)
    else lista.insertBefore(fromEl, el.nextSibling)

    // Save new order
    const newItems = [...lista.querySelectorAll('.nota-item')]
    await Promise.all(newItems.map((item, i) =>
      db.from('notes').update({ sort_order: i }).eq('id', item.dataset.id)
    ))
  })
}

async function togglePinNota(notaId) {
  const { data: nota } = await db.from('notes').select('is_pinned').eq('id', notaId).single()
  if (!nota) return
  const nuevoEstado = !nota.is_pinned
  await db.from('notes').update({ is_pinned: nuevoEstado }).eq('id', notaId)
  if (notaActual?.id === notaId) notaActual.is_pinned = nuevoEstado
  if (libretaActual) await cargarNotas(libretaActual.id)
}

async function nuevaNota() {
  if (!libretaActual) return alert('Select a notebook first.')
  const { data, error } = await db.from('notes').insert({
    notebook_id: libretaActual.id,
    author_id: sesionActual.user.id,
    title_enc: cifrar('New note'),
    content_enc: cifrar(''),
    is_pinned: false,
    color_id: 'none',
    sort_order: 9999
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

  const colorObj = NOTE_COLORS.find(c => c.id === nota.color_id)
  aplicarColorEditor(colorObj?.bg || null)
  historialSesion.push(document.getElementById('nota-contenido').innerHTML)

  if (typeof esMobile === 'function' && esMobile()) mobileNavSelect('editor')

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
  if (libretaActual) await cargarNotas(libretaActual.id)
  document.getElementById('nota-fecha').textContent = 'Modified: ' + formatearFecha(new Date())
}

async function eliminarNota() {
  if (!notaActual) return
  if (!confirm('Move this note to trash?')) return
  await db.from('trash').insert({ note_id: notaActual.id, deleted_by: sesionActual.user.id })
  await db.from('notes').delete().eq('id', notaActual.id)
  if (window._autoguardadoInterval) clearInterval(window._autoguardadoInterval)
  window._hayaCambios = false
  notaActual = null
  aplicarColorEditor(null)
  document.getElementById('editor-placeholder').style.display = 'flex'
  document.getElementById('editor-contenido').style.display = 'none'
  if (typeof cerrarTodos === 'function') cerrarTodos()
  if (libretaActual) await cargarNotas(libretaActual.id)
  await cargarPapeleraCuenta()
}

function ordenarNotas(valor) {
  if (libretaActual) cargarNotas(libretaActual.id, valor)
}

// ==================== ATTACHMENTS ====================

let attachmentsContext = null

function abrirAttachmentsNota() {
  if (!notaActual) return alert('Select a note first.')
  attachmentsContext = 'note'
  abrirAttachmentsScreen(`Note: ${descifrar(notaActual.title_enc) || 'Untitled'}`)
}

function abrirAttachmentsLibreta() {
  if (!libretaActual) return alert('Select a notebook first.')
  attachmentsContext = 'notebook'
  abrirAttachmentsScreen(`Notebook: ${descifrar(libretaActual.name_enc)}`)
}

function abrirAttachmentsScreen(titulo) {
  document.getElementById('attachments-title').textContent = titulo
  document.getElementById('attachments-screen').classList.add('open')
  if (typeof esMobile === 'function' && esMobile()) mobileNavSelect('attachments')
}

function cerrarAttachments() {
  document.getElementById('attachments-screen')?.classList.remove('open')
  attachmentsContext = null
  if (typeof esMobile === 'function' && esMobile()) mobileNavSelect(notaActual ? 'editor' : 'notas')
}

function subirAttachment() { alert('Attachment upload — coming soon.') }

// ==================== EDITOR ====================

function formatear(comando) {
  document.execCommand(comando, false, null)
  document.getElementById('nota-contenido').focus()
}

function highlight(color) {
  const sel = window.getSelection()
  if (!sel.rangeCount || sel.isCollapsed) return
  const range = sel.getRangeAt(0)
  const mark = document.createElement('mark')
  mark.className = color === 'yellow' ? 'hl-yellow' : 'hl-pink'
  try { range.surroundContents(mark) } catch(e) {}
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

async function verVersiones() {
  if (!notaActual) return
  const { data } = await db.from('note_versions').select('*')
    .eq('note_id', notaActual.id).order('saved_at', { ascending: false })
  if (!data?.length) return alert('No saved versions for this note.')
  const lista = data.map((v, i) => `${i + 1}. ${formatearFecha(v.saved_at)}`).join('\n')
  const sel = prompt(`Versions:\n${lista}\n\nEnter number to restore:`)
  if (!sel) return
  const idx = parseInt(sel) - 1
  if (isNaN(idx) || !data[idx]) return alert('Invalid number.')
  document.getElementById('nota-titulo').value = descifrar(data[idx].title_enc)
  document.getElementById('nota-contenido').innerHTML = descifrar(data[idx].content_enc)
  window._hayaCambios = true
  alert('Version restored. Save to confirm.')
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
  if (input) {
    input.addEventListener('input', () => {
      const termino = input.value.toLowerCase()
      document.querySelectorAll('.nota-item').forEach(el => {
        const titulo = el.querySelector('.nota-item-titulo')?.textContent.toLowerCase() || ''
        const preview = el.querySelector('.nota-item-preview')?.textContent.toLowerCase() || ''
        el.style.display = titulo.includes(termino) || preview.includes(termino) ? '' : 'none'
      })
    })
  }

  const sidebarSearch = document.getElementById('sidebar-search')
  if (sidebarSearch) sidebarSearch.addEventListener('input', () => buscarGlobal(sidebarSearch.value))
}

async function buscarGlobal(termino) {
  if (!termino) {
    document.getElementById('libreta-nombre').textContent = libretaActual
      ? descifrar(libretaActual.name_enc) : 'Select a notebook'
    if (libretaActual) cargarNotas(libretaActual.id)
    return
  }

  const { data } = await db.from('notes')
    .select('id, title_enc, content_enc, notebook_id, updated_at, is_pinned, color_id')
  if (!data) return

  const resultados = data.filter(n => {
    const titulo = descifrar(n.title_enc).toLowerCase()
    const contenido = descifrar(n.content_enc).replace(/<[^>]+>/g, '').toLowerCase()
    return titulo.includes(termino.toLowerCase()) || contenido.includes(termino.toLowerCase())
  })

  const lista = document.getElementById('notas-list')
  lista.innerHTML = ''
  document.getElementById('libreta-nombre').textContent = `Results: "${termino}" (${resultados.length})`

  if (!resultados.length) {
    lista.innerHTML = '<li class="nota-empty">No results found.</li>'
    return
  }

  resultados.forEach(nota => {
    const colorObj = NOTE_COLORS.find(c => c.id === nota.color_id)
    const bgColor = colorObj?.bg || ''
    const li = document.createElement('li')
    li.className = 'nota-item'
    li.dataset.id = nota.id
    if (bgColor) li.style.background = bgColor
    li.innerHTML = `
      <div class="nota-item-header">
        <div class="nota-item-titulo">${descifrar(nota.title_enc) || 'Untitled'}</div>
        <div class="nota-item-actions">
          <button class="nota-pin-btn ${nota.is_pinned ? 'pinned' : ''}"
            onclick="event.stopPropagation(); togglePinNota('${nota.id}')" title="Pin">📌</button>
        </div>
      </div>
      <div class="nota-item-preview">${descifrar(nota.content_enc)?.replace(/<[^>]+>/g, '').substring(0, 60) || '...'}</div>
      <div class="nota-item-fecha">${formatearFecha(nota.updated_at)}</div>
    `
    li.onclick = () => abrirNota(nota, li)
    lista.appendChild(li)
  })

  if (typeof esMobile === 'function' && esMobile()) mobileNavSelect('notas')
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
  return new Date(fecha).toLocaleDateString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// ==================== MODULOS ====================

function abrirTodos() { iniciarTodos() }
function abrirRecordatorio() { alert('Reminder — coming soon.') }