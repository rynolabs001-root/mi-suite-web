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
  ;['sidebar', 'notas-panel', 'editor-panel', 'todos-panel'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.style.display = 'none'
  })
  document.querySelectorAll('.resizer').forEach(r => r.style.display = 'none')
}

function mostrarPanel(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.style.display = 'flex'
  el.style.width = '100%'
  el.style.height = 'calc(var(--vh, 1vh) * 100 - 52px)'
  el.style.flex = 'none'
  el.style.borderRight = 'none'
  el.style.borderLeft = 'none'
  el.style.borderBottom = 'none'
  el.style.overflowX = 'hidden'
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
        tp.style.display = 'flex'
        tp.style.width = '100%'
        tp.style.height = 'calc(var(--vh, 1vh) * 100 - 52px)'
        tp.style.flex = 'none'
        tp.style.borderLeft = 'none'
        tp.style.borderRight = 'none'
        tp.style.borderBottom = 'none'
        tp.style.position = 'relative'
        tp.style.zIndex = '10'
        tp.style.overflowX = 'hidden'
      }
      // Hide add bar — use navbar button
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

    case 'attachments': {
      mostrarPanel('editor-panel')
      document.getElementById('attachments-screen')?.classList.add('open')
      actualizarNavbarMobile('attachments')
      break
    }

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
        <div class="nav-right" style="gap:10px;">
          <a href="#" onclick="cerrarSesion()" style="font-size:13px;">Sign out</a>
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
          ‹ Home
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
        <button onclick="subirAttachment()"
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
  mobileNavSelect('inicio')
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

// ==================== PATCH SIDEBAR ====================

function patchTodosSidebar() {
  // To-Do's section click
  document.querySelectorAll('.sidebar-section').forEach(section => {
    const title = section.querySelector('.sidebar-section-title')
    if (title?.textContent.trim() === "To-Do's") {
      section.onclick = () => esMobile() ? mobileNavSelect('todos') : abrirTodosGlobalModo('list')
    }
    if (title?.textContent.trim() === 'Kanban') {
      section.onclick = () => esMobile() ? mobileNavSelect('todos') : abrirTodosGlobalModo('kanban')
    }
  })

  // Summary rows
  document.querySelectorAll('#todos-list-summary .summary-row').forEach(row => {
    row.onclick = () => esMobile() ? mobileNavSelect('todos') : abrirTodosGlobalModo('list')
  })

  document.querySelectorAll('#kanban-cols-summary .summary-row').forEach(row => {
    row.onclick = () => esMobile() ? mobileNavSelect('todos') : abrirTodosGlobalModo('kanban')
  })
}

function patchPapeleraSidebar() {
  const item = document.querySelector('.papelera-item')
  if (item) item.onclick = () => esMobile() ? mobileNavSelect('papelera') : abrirPapelera()
}

// ==================== SWIPE ====================

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

  if (sidebar) sidebar.style.cssText = 'display:flex;width:220px;height:100%;flex:none;border-right:1px solid var(--border);overflow-x:hidden;'
  if (notasPanel) notasPanel.style.cssText = 'display:flex;width:260px;height:100%;flex:none;border-right:1px solid var(--border);overflow-x:hidden;'
  if (editorPanel) editorPanel.style.cssText = 'display:flex;flex:1;height:100%;min-width:0;'
  if (todosPanel) todosPanel.style.cssText = 'display:none;'
  if (addBar) addBar.style.display = 'flex'

  aplicarTheme()
}

// ==================== CSS ====================

const mobileNavStyle = document.createElement('style')
mobileNavStyle.textContent = `
  .mobile-nav { display: none !important; }

  @media (max-width: 768px) {
    nav {
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    nav strong {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.3px;
      text-align: left;
      flex-shrink: 0;
    }

    .notas-layout {
      flex-direction: column;
      height: auto;
      overflow: visible;
      position: relative;
    }

    .editor-toolbar {
      overflow-x: auto;
      flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }

    .editor-toolbar::-webkit-scrollbar { display: none; }
    .editor-titulo { font-size: 18px; padding: 14px 16px 6px; }
    .editor-area { padding: 6px 16px 100px; font-size: 15px; -webkit-overflow-scrolling: touch; }
    .editor-footer { padding: 8px 16px; }
    .editor-footer-actions { display: none; }

    .kanban-col { min-width: 140px; }
    .todos-body { -webkit-overflow-scrolling: touch; overflow-x: hidden; }
    .todos-panel { position: relative; z-index: 10; overflow-x: hidden; }
    .sidebar-footer { padding-bottom: max(12px, env(safe-area-inset-bottom)); }
    .libretas-wrap { flex: none; max-height: 40vh; }
    .todos-summary-wrap { flex: none; overflow-x: hidden; }

    .nota-item { overflow: hidden; }
    .nota-item-header { overflow: hidden; }
    .nota-item-titulo { min-width: 0; }

    .attachments-screen {
      position: fixed;
      top: 52px;
      z-index: 100;
    }

    .color-picker-popup {
      position: fixed !important;
      bottom: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      top: auto !important;
      right: auto !important;
      width: calc(100% - 32px) !important;
      max-width: 340px !important;
    }
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
  setTimeout(() => {
    patchTodosSidebar()
    patchPapeleraSidebar()
  }, 1500)
})