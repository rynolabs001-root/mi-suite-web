// En la función nuevaNota() — verifica que libretaActual exista
// El bug es que el botón llama nuevaNota() pero libretaActual puede ser null
// REEMPLAZA la función nuevaNota completa:

async function nuevaNota() {
  if (!libretaActual) {
    alert('Please select a notebook first.')
    return
  }
  if (!sesionActual) {
    console.error('No session available')
    return
  }

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
    alert('Error creating note: ' + error.message)
    return
  }

  await cargarNotas(libretaActual.id)
  // Find the newly created item and open it
  const lista = document.getElementById('notas-list')
  const items = lista.querySelectorAll('.nota-item')
  // Open the note directly from data
  abrirNota(data)
}

async function nuevaNota() {
  if (!libretaActual) {
    alert('Please select a notebook first.')
    return
  }
  if (!sesionActual) return

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
    alert('Error creating note: ' + error.message)
    return
  }

  await cargarNotas(libretaActual.id)
  abrirNota(data)
}