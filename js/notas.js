let notaActual = null
let libretaActual = null
let sesionActual = null
let historialSesion = []

// Colors 20% more muted
const NOTE_COLORS = [
  { id: 'none',   bg: null,      label: 'Default' },
  { id: 'yellow', bg: '#fde68a', label: 'Yellow'  },
  { id: 'blue',   bg: '#bfdbfe', label: 'Blue'    },
  { id: 'green',  bg: '#bbf7d0', label: 'Green'   },
  { id: 'pink',   bg: '#fecdd3', label: 'Pink'    },
  { id: 'purple', bg: '#e9d5ff', label: 'Purple'  },
  { id: 'orange', bg: '#fed7aa', label: 'Orange'  },
  { id: 'gray',   bg: '#e2e8f0', label: 'Gray'    },
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
  const container = document.getElementById('color-swatches-editor')
  if (!container) return
  container.innerHTML = ''
  NOTE_COLORS.forEach(color => {
    const div = document.createElement('div')
    div.className = 'color-swatch'
    div.title = color.label
    div.dataset.colorId = color.id
    div.style.background = color.bg || '#ffffff'
    if (!color.bg) div.style.border = '1.5px solid var(--border2)'
    div.onclick = e => { e.stopPropagation(); aplicarColorNota(color) }
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
    sincronizarSwatchesEditor()
    setTimeout(() => {
      document.addEventListener('click', cerrarColorPickerFueraEditor, { once: true })
    }, 50)
  }
}

function cerrarColorPickerFueraEditor(e) {
  const popup = document.getElementById('color-picker-editor')
  const btn = document.getElementById('btn-color')
  if (!popup) return
  if (popup.contains(e.target) || e.target === btn) {
    setTimeout(() => {
      document.addEventListener('click', cerrarColorPickerFueraEditor, { once: true })
    }, 50)
    return
  }
  popup.classList.remove('open')
}

function sincronizarSwatchesEditor() {
  const currentId = notaActual?.color_id || 'none'
  document.querySelectorAll('#color-swatches-editor .color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.colorId === currentId)
  })
}

function cerrarTodosLosColorPickers() {
  document.querySelectorAll('.color-picker-popup').forEach(p => p.classList.remove('open'))
  document.querySelectorAll('.nota-color-inline').forEach(p => p.classList.remove('open'))
  document.removeEventListener('click', cerrarColorPickerFueraEditor)
}

async function aplicarColorNota(color) {
  if (!notaActual) return
  const { error } = await db.from('notes').update({ color_id: color.id }).eq('id', notaActual.id)
  if (error) return console.error(error)
  notaActual.color_id = color.id
  aplicarColorEditor(color.bg)
  sincronizarSwatchesEditor()
  actualizarColorEnLista(notaActual.id, color)
}

async function aplicarColorNotaById(notaId, color) {
  const { error } = await db.from('notes').update({ color_id: color.id }).eq('id', notaId)
  if (error) return console.error(error)
  if (notaActual?.id === notaId) {
    notaActual.color_id = color.id
    aplicarColorEditor(color.bg)
    sincronizarSwatchesEditor()
  }
  actualizarColorEnLista(notaId, color)
}

function actualizarColorEnLista(notaId, color) {
  const li = document.querySelector(`.nota-item[data-id="${notaId}"]`)
  if (!li) return
  li.style.background = color.bg || ''
  const dot = li.querySelector('.nota-color-dot')
  if (dot) {
    dot.style.background = color.bg || '#e0e0e0'
    dot.classList.toggle('has-color', !!color.bg)
  }
  li.querySelectorAll('.nota-color-inline .color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.colorId === color.id)
  })
  const inline = li.querySelector('.nota-color-inline')
  if (inline) inline.classList.remove('open')
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
  const { data, error } = await db.from('notebooks').select('*').order('sort_order', { ascending: true })
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

  const todoBadge = document.getElementById('todos-total-badge')
  if (todoBadge) {
    todoBadge.textContent = `${pendientes} pending`
    todoBadge.className = 'sidebar-section-badge' + (pendientes > 0 ? ' warn' : '')
  }
  const pendingEl = document.getElementById('todos-pending-count')
  const doneEl = document.getElementById('todos-done-count')
  if (pendingEl) pendingEl.textContent = pendientes
  if (doneEl) doneEl.textContent = done

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

  if (!kanbanCols.length) {
    kanbanSummary.innerHTML = '<div style="padding:8px 10px;font-size:11px;color:var(--text3);text-align:center;">No columns yet.</div>'
  } else {
    kanbanCols.forEach((col, i) => {
      const count = allTodos.filter(t => t.kanban_column_id === col.id && t.status === 'in_progress').length
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
  const el = document.getElementById('papelera-count')
  if (el) el.textContent = data?.length || 0
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
            title="${nota.is_pinned ? 'Unpin' : 'Pin'}">📌</button>
          <div class="nota-color-dot ${bgColor ? 'has-color' : ''}"
            style="background:${bgColor || '#e0e0e0'};"
            onclick="event.stopPropagation(); toggleColorInline(event, '${nota.id}')"
            title="Note color"></div>
        </div>
      </div>
      <div class="nota-color-inline" id="color-inline-${nota.id}"></div>
      <div class="nota-item-preview">
        ${descifrar(nota.content_enc)?.replace(/<[^>]+>/g, '').substring(0, 60) || '...'}
      </div>
      <div class="nota-item-fecha">${formatearFecha(nota.updated_at)}</div>
    `

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
          // Instant preview
          const parentLi = swatch.closest('.nota-item')
          if (parentLi) {
            parentLi.style.background = color.bg || ''
            const dot = parentLi.querySelector('.nota-color-dot')
            if (dot) {
              dot.style.background = color.bg || '#e0e0e0'
              dot.classList.toggle('has-color', !!color.bg)
            }
            inlineEl.querySelectorAll('.color-swatch').forEach(s => {
              s.classList.toggle('selected', s.dataset.colorId === color.id)
            })
          }
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
  document.querySelectorAll('.nota-color-inline.open').forEach(el => el.classList.remove('open'))
  if (!isOpen) {
    inline.classList.add('open')
    setTimeout(() => {
      function handler(ev) {
        if (inline.contains(ev.target)) return
        inline.classList.remove('open')
        document.removeEventListener('click', handler)
      }
      document.addEventListener('click', handler)
    }, 50)
  }
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
    if (e.clientY < rect.top + rect.height / 2) el.parentNode.insertBefore(ind, el)
    else el.parentNode.insertBefore(ind, el.nextSibling)
    el.classList.add('drag-over')
  })
  el.addEventListener('drop', async e => {
    e.preventDefault()
    if (!dragNotaId || dragNotaId === nota.id) return
    document.querySelectorAll('.nota-drop-indicator').forEach(i => i.remove())
    document.querySelectorAll('.nota-item.drag-over').forEach(i => i.classList.remove('drag-over'))
    const lista = document.getElementById('notas-list')
    const fromEl = lista.querySelector(`.nota-item[data-id="${dragNotaId}"]`)
    if (!fromEl) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (e.clientY < rect.top + rect.height / 2) lista.insertBefore(fromEl, el)
    else lista.insertBefore(fromEl, el.nextSibling)
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
  if (!libretaActual) { alert('Please select a notebook first.'); return }
  if (!sesionActual) { console.error('No session'); return }

  const { data, error } = await db.from('notes').insert({
    notebook_id: libretaActual.id,
    author_id: sesionActual.user.id,
    title_enc: cifrar('New note'),
    content_enc: cifrar(''),
    is_pinned: false,
    color_id: 'none',
    sort_order: 9999
  }).select().single()

  if (error) {
    console.error('Error creating note:', error)
    alert('Error: ' + error.message)
    return
  }

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
    // Restore chip event listeners
  setTimeout(() => restaurarChipsEnEditor(), 100)
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
  notaActual.title_enc = cifrar(titulo)
  window._hayaCambios = false
  await registrarActividad('saved note')

  // Update title in notes list without full reload
  const itemTitulo = document.querySelector(`.nota-item[data-id="${notaActual.id}"] .nota-item-titulo`)
  if (itemTitulo) itemTitulo.textContent = titulo || 'Untitled'

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
function abrirRecordatorio() { alert('Reminder — coming soon.') }

// ==================== ATTACHMENTS ====================

const ATT_ALLOWED = ['jpg','jpeg','png','gif','webp','bmp','tif','tiff','pdf','docx','xlsx','zip']
const ATT_BLOCKED = ['exe','bat','sh','cmd','msi','dmg','app','js','vbs','ps1','jar','com','scr','pif','reg']
const ATT_IMAGES = ['jpg','jpeg','png','gif','webp','bmp','tif','tiff']
const ATT_NOTEBOOK_MAX_KB = 100 * 1024 // 100 MB

let attNotaId = null

async function abrirAttachments() {
  if (!notaActual) return alert('Please select a note first.')
  attNotaId = notaActual.id
  document.getElementById('att-modal-title').textContent = 'Attachments'
  document.getElementById('att-modal-subtitle').textContent = `Note: ${descifrar(notaActual.title_enc) || 'Untitled'}`
  document.getElementById('att-overlay').style.display = 'flex'
  await cargarAttachments()
  await actualizarStorageBar()
}

function cerrarAttModal(e) {
  if (e && e.target !== document.getElementById('att-overlay')) return
  document.getElementById('att-overlay').style.display = 'none'
  attNotaId = null
}

async function cargarAttachments() {
  const grid = document.getElementById('att-grid')
  grid.innerHTML = '<div class="att-empty" style="grid-column:1/-1;">Loading...</div>'

  const { data, error } = await db
    .from('note_attachments')
    .select('*')
    .eq('note_id', attNotaId)
    .eq('is_deleted', false)
    .order('uploaded_at', { ascending: false })

  if (error) { console.error(error); return }

  grid.innerHTML = ''

  if (!data.length) {
    grid.innerHTML = '<div class="att-empty" style="grid-column:1/-1;">No attachments yet.</div>'
    return
  }

  data.forEach(att => grid.appendChild(crearAttCard(att)))
}

function crearAttCard(att) {
  const ext = att.filename.split('.').pop().toLowerCase()
  const isImage = ATT_IMAGES.includes(ext)
  const displayName = att.display_name || att.filename
  const nameSinExt = displayName.includes('.')
    ? displayName.substring(0, displayName.lastIndexOf('.'))
    : displayName

  const card = document.createElement('div')
  card.className = 'att-file'
  card.dataset.id = att.id

  const preview = document.createElement('div')
  preview.className = 'att-file-preview'

  if (isImage) {
    // Get public URL from Supabase storage
    const { data: urlData } = db.storage.from('attachments').getPublicUrl(att.storage_path)
    const img = document.createElement('img')
    img.src = urlData.publicUrl
    img.alt = displayName
    img.onclick = e => { e.stopPropagation(); abrirLightbox(urlData.publicUrl, displayName) }
    preview.appendChild(img)
  } else {
    preview.textContent = attIcono(ext)
  }

  const nameEl = document.createElement('div')
  nameEl.className = 'att-file-name'
  nameEl.textContent = nameSinExt
  nameEl.title = 'Click to rename'
  nameEl.contentEditable = true
  nameEl.spellcheck = false
  nameEl.onclick = e => e.stopPropagation()
  nameEl.onblur = async () => {
    const nuevoNombre = nameEl.textContent.trim()
    if (!nuevoNombre || nuevoNombre === nameSinExt) return
    // Keep original extension
    const extOriginal = att.filename.split('.').pop()
    const nuevoDisplay = `${nuevoNombre}.${extOriginal}`
    await db.from('note_attachments').update({ display_name: nuevoDisplay }).eq('id', att.id)
  }
  nameEl.onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); nameEl.blur() }
    if (e.key === 'Escape') { nameEl.textContent = nameSinExt; nameEl.blur() }
  }

  const sizeEl = document.createElement('div')
  sizeEl.className = 'att-file-size'
  sizeEl.textContent = formatSize(att.size_kb)

  const actions = document.createElement('div')
  actions.className = 'att-file-actions'

  const btnDownload = document.createElement('button')
  btnDownload.className = 'att-file-btn'
  btnDownload.textContent = '⬇'
  btnDownload.title = 'Download'
  btnDownload.onclick = async e => {
    e.stopPropagation()
    await descargarAttachment(att)
  }

  const btnDelete = document.createElement('button')
  btnDelete.className = 'att-file-btn danger'
  btnDelete.textContent = '🗑'
  btnDelete.title = 'Delete'
  btnDelete.onclick = async e => {
    e.stopPropagation()
    await eliminarAttachment(att, card)
  }

  actions.appendChild(btnDownload)
  actions.appendChild(btnDelete)

  card.appendChild(preview)
  card.appendChild(nameEl)
  card.appendChild(sizeEl)
  card.appendChild(actions)

  return card
}

function attIcono(ext) {
  const map = {
    pdf: '📄', docx: '📝', xlsx: '📊', zip: '🗜',
    tif: '🖼', tiff: '🖼', bmp: '🖼'
  }
  return map[ext] || '📎'
}

function formatSize(kb) {
  if (!kb) return ''
  if (kb < 1024) return `${kb} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

// ---- Upload ----

function attDragOver(e) {
  e.preventDefault()
  document.getElementById('att-upload-zone').classList.add('dragover')
}

function attDragLeave(e) {
  document.getElementById('att-upload-zone').classList.remove('dragover')
}

function attDrop(e) {
  e.preventDefault()
  document.getElementById('att-upload-zone').classList.remove('dragover')
  const files = e.dataTransfer.files
  if (files.length) attFilesSelected(files)
}

async function attFilesSelected(files) {
  for (const file of files) {
    await subirAttachment(file)
  }
  await cargarAttachments()
  await actualizarStorageBar()
}

async function subirAttachment(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  // Block executables
  if (ATT_BLOCKED.includes(ext)) {
    alert(`File type .${ext} is not allowed.`)
    return
  }

  // Check allowed
  if (!ATT_ALLOWED.includes(ext)) {
    alert(`File type .${ext} is not supported.`)
    return
  }

  // Check notebook storage limit
  const usadoKb = await obtenerStorageUsado()
  const fileKb = Math.ceil(file.size / 1024)
  if (usadoKb + fileKb > ATT_NOTEBOOK_MAX_KB) {
    alert(`Not enough storage. Used: ${formatSize(usadoKb)}, Available: ${formatSize(ATT_NOTEBOOK_MAX_KB - usadoKb)}`)
    return
  }

  // Show progress
  const progressWrap = document.getElementById('att-progress-wrap')
  const progressName = document.getElementById('att-progress-name')
  const progressFill = document.getElementById('att-progress-fill')
  progressWrap.style.display = 'block'
  progressName.textContent = `Uploading ${file.name}...`
  progressFill.style.width = '10%'

  const path = `${sesionActual.user.id}/${attNotaId}/${Date.now()}_${file.name}`

  const { error: uploadError } = await db.storage
    .from('attachments')
    .upload(path, file, { upsert: false })

  if (uploadError) {
    progressWrap.style.display = 'none'
    console.error(uploadError)
    alert('Upload error: ' + uploadError.message)
    return
  }

  progressFill.style.width = '80%'

  const { error: dbError } = await db.from('note_attachments').insert({
    note_id: attNotaId,
    uploaded_by: sesionActual.user.id,
    filename: file.name,
    display_name: file.name,
    storage_path: path,
    file_type: file.type || ext,
    size_kb: fileKb,
    is_deleted: false
  })

  if (dbError) {
    console.error(dbError)
    alert('Error saving attachment: ' + dbError.message)
  }

  progressFill.style.width = '100%'
  setTimeout(() => { progressWrap.style.display = 'none'; progressFill.style.width = '0%' }, 600)
}

// ---- Download ----

async function descargarAttachment(att) {
  const { data, error } = await db.storage
    .from('attachments')
    .download(att.storage_path)

  if (error) { console.error(error); alert('Download error.'); return }

  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = att.display_name || att.filename
  a.click()
  URL.revokeObjectURL(url)
}

// ---- Delete (soft) ----

async function eliminarAttachment(att, cardEl) {
  if (!confirm(`Move "${att.display_name || att.filename}" to trash? It will be available for 30 days.`)) return

  const { error } = await db.from('note_attachments').update({
    is_deleted: true,
    deleted_at: new Date().toISOString()
  }).eq('id', att.id)

  if (error) { console.error(error); return }

  cardEl.style.transition = 'opacity 0.3s, transform 0.3s'
  cardEl.style.opacity = '0'
  cardEl.style.transform = 'scale(0.9)'
  setTimeout(() => {
    cardEl.remove()
    const grid = document.getElementById('att-grid')
    if (!grid.querySelector('.att-file')) {
      grid.innerHTML = '<div class="att-empty" style="grid-column:1/-1;">No attachments yet.</div>'
    }
    actualizarStorageBar()
  }, 300)
}

// ---- Storage bar ----

async function obtenerStorageUsado() {
  // Get all non-deleted attachments for notes in same notebook
  if (!notaActual || !libretaActual) return 0

  const { data: notas } = await db
    .from('notes')
    .select('id')
    .eq('notebook_id', libretaActual.id)

  if (!notas?.length) return 0

  const noteIds = notas.map(n => n.id)
  const { data: atts } = await db
    .from('note_attachments')
    .select('size_kb')
    .in('note_id', noteIds)
    .eq('is_deleted', false)

  return (atts || []).reduce((sum, a) => sum + (a.size_kb || 0), 0)
}

async function actualizarStorageBar() {
  const usadoKb = await obtenerStorageUsado()
  const pct = Math.min((usadoKb / ATT_NOTEBOOK_MAX_KB) * 100, 100)

  const usedEl = document.getElementById('att-storage-used')
  const pctEl = document.getElementById('att-storage-pct')
  const fillEl = document.getElementById('att-storage-fill')

  if (usedEl) usedEl.textContent = `${formatSize(usadoKb)} used`
  if (pctEl) pctEl.textContent = `${pct.toFixed(1)}% of 100 MB`
  if (fillEl) {
    fillEl.style.width = `${pct}%`
    fillEl.className = `att-storage-fill${pct > 90 ? ' danger' : pct > 70 ? ' warn' : ''}`
  }
}

// ---- Lightbox ----

function abrirLightbox(url, nombre) {
  const lb = document.getElementById('att-lightbox')
  const img = document.getElementById('att-lightbox-img')
  if (!lb || !img) return
  img.src = url
  img.alt = nombre
  lb.style.display = 'flex'
}

function cerrarLightbox() {
  const lb = document.getElementById('att-lightbox')
  if (lb) lb.style.display = 'none'
  const img = document.getElementById('att-lightbox-img')
  if (img) img.src = ''
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

function abrirRecordatorio() { alert('Reminder � coming soon.') }

}

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
