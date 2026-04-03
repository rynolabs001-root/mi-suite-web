const MOBILE_BREAKPOINT = 768
let mobileVista = 'inicio'

function esMobile() {
  return window.innerWidth <= MOBILE_BREAKPOINT
}

function iniciarMobileNav() {
  if (!esMobile()) return
  ajustarAlturaViewport()
  aplicarVistaMobile('inicio')
}

function ajustarAlturaViewport() {
  const vh = window.innerHeight * 0.01
  document.documentElement.style.setProperty('--vh', `${vh}px`)
}

window.addEventListener('resize', () => {
  ajustarAlturaViewport()
  if (!esMobile()) restaurarDesktop()
  else aplicarVistaMobile(mobileVista)
})

window.addEventListener('orientationchange', () => {
  setTimeout(ajustarAlturaViewport, 100)
})

// ==================== VISTAS ====================

function mobileNavSelect(vista) {
  if (!esMobile()) return
  mobileVista = vista
  aplicarVistaMobile(vista)
}

function ocultarTodo() {
  ;['sidebar','notas-panel','editor-panel','todos-panel','welcome-panel'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.style.display = 'none'
  })
  document.querySelectorAll('.resizer').forEach(r => r.style.display = 'none')
}

function mostrarPanel(id) {
  const el = document.getElementById(id)
  if (!el) return
  const altura = 'calc(var(--vh, 1vh) * 100 - 52px)'
  el.style.display = 'flex'
  el.style.width = '100%'
  el.style.maxWidth = '100vw'
  el.style.height = altura
  el.style.flex = 'none'
  el.style.borderRight = 'none'
  el.style.borderLeft = 'none'
  el.style.borderBottom = 'none'
  el.style.overflowX = 'hidden'
  el.style.boxSizing = 'border-box'
}

function aplicarVistaMobile(vista) {
  ocultarTodo()

  switch (vista) {
    case 'inicio':
      mostrarPanel('sidebar')
      actualizarNavbarMobile('inicio')
      break

    case 'notas':
      mostrarPanel('notas-panel')
      actualizarNavbarMobile('notas')
      break

    case 'editor':
      mostrarPanel('editor-panel')
      document.getElementById('attachments-screen')?.classList.remove('open')
      actualizarNavbarMobile('editor')
      break

    case 'todos': {
      const tp = document.getElementById('todos-panel')
      if (tp) {
        const altura = 'calc(var(--vh, 1vh) * 100 - 52px)'
        tp.style.display = 'flex'
        tp.style.width = '100%'
        tp.style.maxWidth = '100vw'
        tp.style.height = altura
        tp.style.flex = 'none'
        tp.style.borderLeft = 'none'
        tp.style.borderRight = 'none'
        tp.style.borderBottom = 'none'
        tp.style.position = 'relative'
        tp.style.zIndex = '10'
        tp.style.overflowX = 'hidden'
        tp.style.boxSizing = 'border-box'
      }
      const addBar = document.getElementById('todo-add-bar')
      if (addBar) addBar.style.display = 'none'
      actualizarNavbarMobile('todos')
      notaActual = null
      cargarTodosGlobal().then(() => {
        renderTodos()
        setTodosMode(todosMode || 'list')
      })
      break
    }

    case 'attachments':
      mostrarPanel('editor-panel')
      document.getElementById('attachments-screen')?.classList.add('open')
      actualizarNavbarMobile('attachments')
      break

    case 'papelera':
      mostrarPanel('sidebar')
      actualizarNavbarMobile('papelera')
      setTimeout(() => {
        alert('Trash — coming soon.')
        mobileNavSelect('inicio')
      }, 100)
      break
  }
}

// ==================== NAVBAR ====================

function actualizarNavbarMobile(vista) {
  const nav = document.querySelector('nav')
  if (!nav) return

  switch (vista) {
    case 'inicio':
      nav.innerHTML = `
        <strong style="font-size:15px;font-weight:700;letter-spacing:-0.3px;">My Suite</strong>
        <div class="nav-right" style="gap:8px;display:flex;align-items:center;">
          <a href="#" onclick="cerrarSesion()"
            style="font-size:13px;color:var(--accent);text-decoration:none;">Sign out</a>
          <div class="theme-toggle" id="theme-toggle" onclick="toggleTheme()"
            style="width:32px;height:18px;flex-shrink:0;">
            <div class="theme-toggle-thumb"></div>
          </div>
        </div>
      `
      aplicarTheme()
      break

    case 'notas':
      nav.innerHTML = `
        <a href="#" onclick="mobileNavSelect('inicio')"
          style="color:var(--accent);font-size:14px;text-decoration:none;font-family:var(--font);flex-shrink:0;">
          ‹ Home
        </a>
        <strong style="font-size:13px;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 8px;">
          ${libretaActual ? descifrar(libretaActual.name_enc) : 'Notebooks'}
        </strong>
        <button onclick="nuevaNota()"
          style="background:var(--accent);color:#fff;border:none;border-radius:99px;padding:4px 14px;font-size:12px;font-family:var(--font);cursor:pointer;flex-shrink:0;">
          + Note
        </button>
      `
      break

    case 'editor':
      nav.innerHTML = `
        <a href="#" onclick="guardarYRegresar()"
          style="color:var(--accent);font-size:14px;text-decoration:none;font-family:var(--font);flex-shrink:0;">
          ‹ Back
        </a>
        <strong id="nota-titulo-nav"
          style="font-size:13px;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 8px;">
          Note
        </strong>
        <button onclick="guardarYRegresar()"
          style="background:var(--accent);color:#fff;border:none;border-radius:99px;padding:4px 14px;font-size:12px;font-family:var(--font);cursor:pointer;flex-shrink:0;">
          Save
        </button>
      `
      setTimeout(() => {
        const el = document.getElementById('nota-titulo-nav')
        const input = document.getElementById('nota-titulo')
        if (el && input) el.textContent = input.value || 'New note'
      }, 100)
      break

    case 'todos':
      nav.innerHTML = `
        <a href="#" onclick="mobileNavSelect('inicio')"
          style="color:var(--accent);font-size:14px;text-decoration:none;font-family:var(--font);flex-shrink:0;">
          ‹ Home
        </a>
        <strong style="font-size:13px;flex:1;text-align:center;">To-Do's</strong>
        <button onclick="agregarTodoMobile()"
          style="background:var(--accent);color:#fff;border:none;border-radius:99px;padding:4px 14px;font-size:12px;font-family:var(--font);cursor:pointer;flex-shrink:0;">
          + Task
        </button>
      `
      break

    case 'attachments':
      nav.innerHTML = `
        <a href="#" onclick="cerrarAttachments()"
          style="color:var(--accent);font-size:14px;text-decoration:none;font-family:var(--font);flex-shrink:0;">
          ‹ Back
        </a>
        <strong style="font-size:13px;flex:1;text-align:center;">Attachments</strong>
        <button onclick="document.getElementById('att-file-input').click()"
          style="background:var(--accent);color:#fff;border:none;border-radius:99px;padding:4px 14px;font-size:12px;font-family:var(--font);cursor:pointer;flex-shrink:0;">
          + Add
        </button>
      `
      break

    case 'papelera':
      nav.innerHTML = `
        <a href="#" onclick="mobileNavSelect('inicio')"
          style="color:var(--accent);font-size:14px;text-decoration:none;font-family:var(--font);flex-shrink:0;">
          ‹ Home
        </a>
        <strong style="font-size:13px;flex:1;text-align:center;">Trash</strong>
        <span style="width:60px;flex-shrink:0;"></span>
      `
      break
  }
}

// ==================== ACCIONES ====================

async function guardarYRegresar() {
  if (notaActual && window._hayaCambios) await guardarNota()
  mobileNavSelect('notas')
}

function agregarTodoMobile() {
  const addBar = document.getElementById('todo-add-bar')
  const input = document.getElementById('todo-input')
  if (!addBar || !input) return
  addBar.style.display = 'flex'
  input.focus()
  input.addEventListener('blur', () => {
    setTimeout(() => { if (addBar) addBar.style.display = 'none' }, 200)
  }, { once: true })
}

// ==================== SWIPE LEFT TO DELETE ====================

let swipeTarget = null
let swipeStartX = 0
let swipeStartY = 0
let swipeActive = false
let swipeEl = null
let swipeDeleteBtn = null

function iniciarSwipeDelete() {
  document.addEventListener('touchstart', e => {
    const touch = e.touches[0]
    swipeStartX = touch.clientX
    swipeStartY = touch.clientY
    swipeActive = false

    // Find swipeable target
    const el = touch.target.closest('.nota-item, .libreta-item, .todo-item, .kanban-card')
    if (!el) { swipeTarget = null; return }
    swipeTarget = el
    swipeEl = el
  }, { passive: true })

  document.addEventListener('touchmove', e => {
    if (!swipeTarget) return
    const touch = e.touches[0]
    const dx = touch.clientX - swipeStartX
    const dy = Math.abs(touch.clientY - swipeStartY)

    // Only horizontal swipe left
    if (dy > 20 || dx > 0) { swipeTarget = null; return }
    if (dx < -10) swipeActive = true
    if (!swipeActive) return

    e.preventDefault()
    const moveX = Math.max(-80, Math.min(0, dx))
    swipeTarget.style.transform = `translateX(${moveX}px)`
    swipeTarget.style.transition = 'none'

    // Show delete button behind
    if (!swipeDeleteBtn) {
      swipeDeleteBtn = document.createElement('div')
      swipeDeleteBtn.style.cssText = `
        position:absolute;right:0;top:0;bottom:0;width:80px;
        background:var(--danger);display:flex;align-items:center;
        justify-content:center;font-size:13px;color:#fff;font-weight:600;
        border-radius:0 8px 8px 0;cursor:pointer;z-index:1;
        font-family:var(--font);
      `
      swipeDeleteBtn.textContent = 'Delete'
      swipeTarget.style.position = 'relative'
      swipeTarget.parentNode.style.position = 'relative'
      swipeTarget.parentNode.style.overflow = 'hidden'
      swipeTarget.insertAdjacentElement('afterend', swipeDeleteBtn)

      swipeDeleteBtn.addEventListener('click', () => {
        ejecutarSwipeDelete(swipeTarget)
      })
    }
  }, { passive: false })

  document.addEventListener('touchend', e => {
    if (!swipeTarget || !swipeActive) return
    const dx = e.changedTouches[0].clientX - swipeStartX

    if (dx < -60) {
      // Snap to show delete button
      swipeTarget.style.transition = 'transform 0.2s ease'
      swipeTarget.style.transform = 'translateX(-80px)'
    } else {
      // Snap back
      resetSwipe()
    }

    swipeTarget = null
    swipeActive = false
  }, { passive: true })

  // Close swipe on scroll or tap elsewhere
  document.addEventListener('touchstart', e => {
    if (swipeEl && swipeDeleteBtn && !swipeEl.contains(e.target) && !swipeDeleteBtn.contains(e.target)) {
      resetSwipe()
    }
  }, { passive: true })
}

function resetSwipe() {
  if (swipeEl) {
    swipeEl.style.transition = 'transform 0.2s ease'
    swipeEl.style.transform = 'translateX(0)'
  }
  if (swipeDeleteBtn) { swipeDeleteBtn.remove(); swipeDeleteBtn = null }
  swipeEl = null
}

async function ejecutarSwipeDelete(el) {
  resetSwipe()

  // Nota item
  const notaId = el.dataset.id
  if (el.classList.contains('nota-item') && notaId) {
    el.style.transition = 'opacity 0.3s, transform 0.3s'
    el.style.opacity = '0'
    el.style.transform = 'translateX(-100%)'
    setTimeout(async () => {
      const nota = { id: notaId }
      notaActual = nota
      await eliminarNota()
    }, 300)
    return
  }

  // Libreta item
  if (el.classList.contains('libreta-item') && notaId) {
    if (!confirm('Delete this notebook and all its notes?')) return
    el.style.transition = 'opacity 0.3s'
    el.style.opacity = '0'
    setTimeout(async () => {
      await db.from('notes').delete().eq('notebook_id', notaId)
      await db.from('notebooks').delete().eq('id', notaId)
      await cargarLibretas()
    }, 300)
    return
  }

  // Todo item
  if (el.classList.contains('todo-item') && notaId) {
    el.style.transition = 'opacity 0.3s, transform 0.3s'
    el.style.opacity = '0'
    el.style.transform = 'translateX(-100%)'
    setTimeout(async () => {
      await eliminarTodo(notaId)
    }, 300)
    return
  }

  // Kanban card
  if (el.classList.contains('kanban-card') && notaId) {
    el.style.transition = 'opacity 0.3s, transform 0.3s'
    el.style.opacity = '0'
    el.style.transform = 'translateX(-100%)'
    setTimeout(async () => {
      await eliminarTodo(notaId)
    }, 300)
    return
  }
}

// ==================== PATCH SIDEBAR ====================

function patchTodosSidebar() {
  const zoneTodos = document.getElementById('zone-todos')
  const zoneKanban = document.getElementById('zone-kanban')
  if (zoneTodos) zoneTodos.onclick = () => esMobile() ? mobileNavSelect('todos') : handleZoneTodos()
  if (zoneKanban) zoneKanban.onclick = () => esMobile() ? mobileNavSelect('todos') : handleZoneKanban()
}

function patchPapeleraSidebar() {
  const item = document.querySelector('.papelera-item')
  if (item) item.onclick = () => esMobile() ? mobileNavSelect('papelera') : abrirPapelera()
}

// ==================== SWIPE BACK ====================

let touchStartX = 0
let touchStartY = 0

document.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
}, { passive: true })

document.addEventListener('touchend', e => {
  if (!esMobile()) return
  const dx = e.changedTouches[0].clientX - touchStartX
  const dy = Math.abs(e.changedTouches[0].clientY - touchStartY)
  if (dx > 80 && dy < 50 && touchStartX < 30) {
    switch (mobileVista) {
      case 'editor': guardarYRegresar(); break
      case 'notas': mobileNavSelect('inicio'); break
      case 'todos': mobileNavSelect('inicio'); break
      case 'attachments': cerrarAttachments(); break
      case 'papelera': mobileNavSelect('inicio'); break
    }
  }
}, { passive: true })

// ==================== RESTAURAR DESKTOP ====================

function restaurarDesktop() {
  const nav = document.querySelector('nav')
  if (nav) {
    nav.innerHTML = `
      <strong>My Suite</strong>
      <div class="nav-right">
        <a href="../index.html">Home</a>
        <a href="calendario.html">Calendar</a>
        <a href="peliculas.html">Movies</a>
        <a href="#" onclick="cerrarSesion()">Sign out</a>
      </div>
    `
  }
  const sidebar = document.getElementById('sidebar')
  const notasPanel = document.getElementById('notas-panel')
  const editorPanel = document.getElementById('editor-panel')
  const todosPanel = document.getElementById('todos-panel')
  const addBar = document.getElementById('todo-add-bar')
  if (sidebar) sidebar.style.cssText = 'display:flex;width:220px;height:100%;flex:none;border-right:1px solid var(--border);overflow-x:hidden;max-width:none;'
  if (notasPanel) notasPanel.style.cssText = 'display:none;'
  if (editorPanel) editorPanel.style.cssText = 'display:none;'
  if (todosPanel) todosPanel.style.cssText = 'display:none;'
  if (addBar) addBar.style.display = 'flex'
  // Show welcome panel
  const welcome = document.getElementById('welcome-panel')
  if (welcome) { welcome.style.display = 'flex'; welcome.style.flex = '1' }
  aplicarTheme()
}

// ==================== CSS MOBILE ====================

const mobileNavStyle = document.createElement('style')
mobileNavStyle.textContent = `
  .mobile-nav { display: none !important; }
  @media (max-width: 768px) {
    html, body { overflow-x: hidden; max-width: 100vw; }
    nav { padding: 0 16px; display: flex; align-items: center; justify-content: space-between; gap: 8px; max-width: 100vw; overflow: hidden; box-sizing: border-box; }
    nav strong { font-size: 14px; font-weight: 700; letter-spacing: -0.3px; flex-shrink: 0; white-space: nowrap; }
    .notas-layout { flex-direction: column; height: auto; overflow: visible; position: relative; max-width: 100vw; overflow-x: hidden; }
    .resizer { display: none !important; }
    .editor-toolbar { overflow-x: auto; flex-wrap: nowrap; -webkit-overflow-scrolling: touch; scrollbar-width: none; max-width: 100%; }
    .editor-toolbar::-webkit-scrollbar { display: none; }
    .editor-titulo { font-size: 18px; padding: 14px 16px 6px; }
    .editor-area { padding: 6px 16px 100px; font-size: 15px; -webkit-overflow-scrolling: touch; }
    .editor-footer { padding: 8px 16px; }
    .editor-footer-actions { display: none; }
    .kanban-col { min-width: 140px; }
    .todos-body { -webkit-overflow-scrolling: touch; overflow-x: hidden; max-width: 100vw; }
    .todos-panel { overflow-x: hidden; max-width: 100vw; }
    .sidebar-footer { padding-bottom: max(12px, env(safe-area-inset-bottom)); }
    .libretas-wrap { flex: none; max-height: 40vh; overflow: hidden; }
    .todos-summary-wrap { flex: none; overflow-x: hidden; max-width: 100vw; }
    .nota-item { overflow: hidden; max-width: 100%; box-sizing: border-box; }
    .summary-card { max-width: 100%; overflow: hidden; box-sizing: border-box; }
    .sidebar-zone { max-width: 100%; overflow: hidden; box-sizing: border-box; }
    .attachments-screen { position: fixed; top: 52px; z-index: 100; max-width: 100vw; }
    .color-picker-popup { position: fixed !important; bottom: 20px !important; left: 50% !important; transform: translateX(-50%) !important; top: auto !important; right: auto !important; width: calc(100vw - 32px) !important; max-width: 340px !important; }
    .sidebar-footer { display: flex; align-items: center; justify-content: space-between; }
    .notas-panel-subactions button:first-child { display: none; }
  }
  @media (max-width: 768px) and (orientation: landscape) {
    .editor-area { padding-bottom: 60px; }
    .libretas-wrap { max-height: 26vh; }
  }
`
document.head.appendChild(mobileNavStyle)

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', () => {
  iniciarMobileNav()
  if (esMobile()) iniciarSwipeDelete()
  setTimeout(() => {
    patchTodosSidebar()
    patchPapeleraSidebar()
  }, 1500)
})