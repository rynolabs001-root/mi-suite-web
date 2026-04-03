// ==================== ATTACHMENTS ====================

const ATT_ALLOWED = ['jpg','jpeg','png','gif','webp','bmp','tif','tiff','pdf','docx','xlsx','zip']
const ATT_BLOCKED = ['exe','bat','sh','cmd','msi','dmg','app','js','vbs','ps1','jar','com','scr','pif','reg']
const ATT_IMAGES = ['jpg','jpeg','png','gif','webp','bmp','tif','tiff']
const ATT_NOTEBOOK_MAX_KB = 100 * 1024

let attNotaId = null
let _attCursorRange = null

async function cargarAttachments() {
  const grid = document.getElementById('att-grid')
  grid.innerHTML = '<div class="att-empty" style="grid-column:1/-1;">Loading...</div>'
  const { data, error } = await db.from('note_attachments').select('*')
    .eq('note_id', attNotaId).eq('is_deleted', false)
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
  const nameSinExt = displayName.includes('.') ? displayName.substring(0, displayName.lastIndexOf('.')) : displayName
  const card = document.createElement('div')
  card.className = 'att-file'
  card.dataset.id = att.id
  const preview = document.createElement('div')
  preview.className = 'att-file-preview'
  if (isImage) {
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
  nameEl.contentEditable = true
  nameEl.spellcheck = false
  nameEl.onclick = e => e.stopPropagation()
  nameEl.onblur = async () => {
    const nuevo = nameEl.textContent.trim()
    if (!nuevo || nuevo === nameSinExt) return
    const extOrig = att.filename.split('.').pop()
    await db.from('note_attachments').update({ display_name: nuevo + '.' + extOrig }).eq('id', att.id)
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
  btnDownload.onclick = async e => { e.stopPropagation(); await descargarAttachment(att) }
  const btnDelete = document.createElement('button')
  btnDelete.className = 'att-file-btn danger'
  btnDelete.textContent = '🗑'
  btnDelete.onclick = async e => { e.stopPropagation(); await eliminarAttachment(att, card) }
  actions.appendChild(btnDownload)
  actions.appendChild(btnDelete)
  card.appendChild(preview)
  card.appendChild(nameEl)
  card.appendChild(sizeEl)
  card.appendChild(actions)
  return card
}

function attIcono(ext) {
  const map = { pdf:'📄', docx:'📝', xlsx:'📊', zip:'🗜', tif:'🖼', tiff:'🖼', bmp:'🖼' }
  return map[ext] || '📎'
}

function formatSize(kb) {
  if (!kb) return ''
  if (kb < 1024) return kb + ' KB'
  return (kb / 1024).toFixed(1) + ' MB'
}

function attDragOver(e) {
  e.preventDefault()
  document.getElementById('att-upload-zone').classList.add('dragover')
}

function attDragLeave() {
  document.getElementById('att-upload-zone').classList.remove('dragover')
}

function attDrop(e) {
  e.preventDefault()
  document.getElementById('att-upload-zone').classList.remove('dragover')
  if (e.dataTransfer.files.length) attFilesSelected(e.dataTransfer.files)
}

async function attFilesSelected(files) {
  for (const file of files) { await subirAttachment(file) }
  await cargarAttachments()
  await actualizarStorageBar()
}

async function subirAttachment(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ATT_BLOCKED.includes(ext)) { alert('File type .' + ext + ' is not allowed.'); return }
  if (!ATT_ALLOWED.includes(ext)) { alert('File type .' + ext + ' is not supported.'); return }
  const usadoKb = await obtenerStorageUsado()
  const fileKb = Math.ceil(file.size / 1024)
  if (usadoKb + fileKb > ATT_NOTEBOOK_MAX_KB) {
    alert('Not enough storage. Used: ' + formatSize(usadoKb))
    return
  }
  const progressWrap = document.getElementById('att-progress-wrap')
  const progressName = document.getElementById('att-progress-name')
  const progressFill = document.getElementById('att-progress-fill')
  progressWrap.style.display = 'block'
  progressName.textContent = 'Uploading ' + file.name + '...'
  progressFill.style.width = '10%'
  const path = sesionActual.user.id + '/' + attNotaId + '/' + Date.now() + '_' + file.name
  const { error: uploadError } = await db.storage.from('attachments').upload(path, file, { upsert: false })
  if (uploadError) {
    progressWrap.style.display = 'none'
    alert('Upload error: ' + uploadError.message)
    return
  }
  progressFill.style.width = '80%'
  const { data: attData, error: dbError } = await db.from('note_attachments').insert({
    note_id: attNotaId, uploaded_by: sesionActual.user.id,
    filename: file.name, display_name: file.name,
    storage_path: path, file_type: file.type || ext,
    size_kb: fileKb, is_deleted: false
  }).select().single()
  if (dbError) { console.error(dbError); alert('Error: ' + dbError.message); return }
  progressFill.style.width = '100%'
  setTimeout(() => { progressWrap.style.display = 'none'; progressFill.style.width = '0%' }, 600)
  if (attData) { await insertarChipEnEditor(attData); window._hayaCambios = true }
}

async function insertarChipEnEditor(att) {
  const editor = document.getElementById('nota-contenido')
  if (!editor) return
  const chip = await crearChip(att)
  if (_attCursorRange) {
    try {
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(_attCursorRange)
      _attCursorRange.deleteContents()
      _attCursorRange.insertNode(chip)
      const rangeAfter = document.createRange()
      rangeAfter.setStartAfter(chip)
      rangeAfter.collapse(true)
      sel.removeAllRanges()
      sel.addRange(rangeAfter)
    } catch(e) { editor.appendChild(chip) }
  } else { editor.appendChild(chip) }
  _attCursorRange = null
}

async function crearChip(att) {
  const ext = att.filename.split('.').pop().toLowerCase()
  const isImage = ATT_IMAGES.includes(ext)
  const displayName = att.display_name || att.filename
  const chip = document.createElement('span')
  chip.className = 'att-chip'
  chip.contentEditable = 'false'
  chip.dataset.attId = att.id
  chip.dataset.attPath = att.storage_path
  chip.dataset.attName = displayName
  chip.dataset.attExt = ext
  chip.draggable = true
  const thumb = document.createElement('span')
  thumb.className = 'att-chip-thumb'
  if (isImage) {
    const { data: urlData } = db.storage.from('attachments').getPublicUrl(att.storage_path)
    const img = document.createElement('img')
    img.src = urlData.publicUrl
    img.alt = displayName
    thumb.appendChild(img)
  } else { thumb.textContent = attIcono(ext) }
  const name = document.createElement('span')
  name.className = 'att-chip-name'
  name.textContent = displayName
  chip.appendChild(thumb)
  chip.appendChild(name)
  const menu = document.createElement('div')
  menu.className = 'att-chip-menu'
  const menuItems = [
    { icon: '👁', label: 'View', action: () => verChipAtt(att, chip) },
    { icon: '⬇', label: 'Download', action: () => descargarAttachment(att) },
    { icon: '🗑', label: 'Remove from note', action: () => { chip.remove(); window._hayaCambios = true }, danger: true }
  ]
  menuItems.forEach(item => {
    const btn = document.createElement('button')
    btn.className = 'att-chip-menu-item' + (item.danger ? ' danger' : '')
    btn.innerHTML = '<span style="font-size:12px;">' + item.icon + '</span> ' + item.label
    btn.onclick = e => { e.stopPropagation(); menu.classList.remove('open'); item.action() }
    menu.appendChild(btn)
  })
  chip.appendChild(menu)
  chip.onclick = e => {
    e.stopPropagation(); e.preventDefault()
    document.querySelectorAll('.att-chip-menu.open').forEach(m => { if (m !== menu) m.classList.remove('open') })
    menu.classList.toggle('open')
  }
  document.addEventListener('click', () => menu.classList.remove('open'), { passive: true })
  chip.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/att-chip-id', att.id)
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => chip.style.opacity = '0.4', 0)
  })
  chip.addEventListener('dragend', () => { chip.style.opacity = '1'; window._hayaCambios = true })
  return chip
}

async function verChipAtt(att, chip) {
  const ext = att.filename.split('.').pop().toLowerCase()
  if (ATT_IMAGES.includes(ext)) {
    const { data: urlData } = db.storage.from('attachments').getPublicUrl(att.storage_path)
    abrirLightbox(urlData.publicUrl, att.display_name || att.filename)
  } else { await descargarAttachment(att) }
}

async function descargarAttachment(att) {
  const { data, error } = await db.storage.from('attachments').download(att.storage_path)
  if (error) { console.error(error); alert('Download error.'); return }
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = att.display_name || att.filename
  a.click()
  URL.revokeObjectURL(url)
}

async function eliminarAttachment(att, cardEl) {
  if (!confirm('Move "' + (att.display_name || att.filename) + '" to trash? Available for 30 days.')) return
  const { error } = await db.from('note_attachments').update({
    is_deleted: true, deleted_at: new Date().toISOString()
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

async function obtenerStorageUsado() {
  if (!notaActual || !libretaActual) return 0
  const { data: notas } = await db.from('notes').select('id').eq('notebook_id', libretaActual.id)
  if (!notas?.length) return 0
  const noteIds = notas.map(n => n.id)
  const { data: atts } = await db.from('note_attachments').select('size_kb').in('note_id', noteIds).eq('is_deleted', false)
  return (atts || []).reduce((sum, a) => sum + (a.size_kb || 0), 0)
}

async function actualizarStorageBar() {
  const usadoKb = await obtenerStorageUsado()
  const pct = Math.min((usadoKb / ATT_NOTEBOOK_MAX_KB) * 100, 100)
  const usedEl = document.getElementById('att-storage-used')
  const pctEl = document.getElementById('att-storage-pct')
  const fillEl = document.getElementById('att-storage-fill')
  if (usedEl) usedEl.textContent = formatSize(usadoKb) + ' used'
  if (pctEl) pctEl.textContent = pct.toFixed(1) + '% of 100 MB'
  if (fillEl) {
    fillEl.style.width = pct + '%'
    fillEl.className = 'att-storage-fill' + (pct > 90 ? ' danger' : pct > 70 ? ' warn' : '')
  }
}

function abrirLightbox(url, nombre) {
  const lb = document.getElementById('att-lightbox')
  const img = document.getElementById('att-lightbox-img')
  if (!lb || !img) return
  img.src = url; img.alt = nombre
  lb.style.display = 'flex'
}

function cerrarLightbox() {
  const lb = document.getElementById('att-lightbox')
  if (lb) lb.style.display = 'none'
  const img = document.getElementById('att-lightbox-img')
  if (img) img.src = ''
}

function cerrarAttModal(e) {
  if (e && e.target !== document.getElementById('att-overlay')) return
  document.getElementById('att-overlay').style.display = 'none'
  attNotaId = null
}