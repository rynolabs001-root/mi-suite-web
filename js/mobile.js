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
  const ids = ['sidebar', 'notas-panel', 'editor-panel', 'todos-panel']
  ids.forEach(id => {
    const el = document.getElementById(id)
    if (el) el.style.display = 'none'
  })
  document.querySelectorAll('.resizer').forEach(r => r.style.display = 'none')
  const mobileNav = document.getElementById('mobile-nav')
  if (mobileNav) mobileNav.style.display = 'none'
}

function mostrarPanel(id, extra = {}) {
  const el = document.getElementById(id)
  if (!el) return
  const altura = 'calc(var(--vh, 1vh) * 100 - 52px)'
  el.style.display = 'flex'
  el.style.width = '100%'
  el.style.height = altura
  el.style.flex = 'none'
  el.style.borderRight = 'none'
  el.style.borderLeft = 'none'
  el.style.borderBottom = 'none'
  Object.entries(extra).forEach(([k, v]) => el.style[k] = v)
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
      actualizarNavbarMobile('editor')
      break

    case 'todos': {
      const todosPanel = document.getElementById('todos-panel')
      if (todosPanel) {
        const altura = 'calc(var(--vh, 1vh) * 100 - 52px)'
        todosPanel.style.display = 'flex'
        todosPanel.style.width = '100%'
        todosPanel.style.height = altura
        todosPanel.style.flex = 'none'
        todosPanel.style.borderLeft = 'none'
        todosPanel.style.borderRight = 'none'
        todosPanel.style.borderBottom = 'none'
        todosPanel.style.position = 'relative'
        todosPanel.style.zIndex = '10'
      }
      // Hide bottom add bar on mobile — use navbar button
      const addBar = document.getElementById('todo-add-bar')
      if (addBar) addBar.style.display = 'none'

      actualizarNavbarMobile('todos')
      notaActual = null
      cargarTodosGlobal().then(() => {
        renderTodos()
        const modoActual = todosMode || 'list'
        setTodosMode(modoActual)
      })
      break
    }

    case 'attachments': {
      // Show attachments screen as full screen
      const editorPanel = document.getElementById('editor-panel')
      if (editorPanel) {
        const altura = 'calc(var(--vh, 1vh) * 100 - 52px)'
        editorPanel.style.display = 'flex'
        editorPanel.style.width = '100%'
        editorPanel.style.height = altura
        editorPanel.style.flex = 'none'
      }
      const attScreen = document.getElementById('attachments-screen')
      if (attScreen) attScreen.classList.add('open')
      actualizarNavbarMobile('attachments')
      break
    }

    case 'papelera':
      actualizarNavbarMobile('papelera')
      abrirPapelera()
      break
  }
}

// ==================== NAVBAR DINAMICO ====================

function actualizarNavbarMobile(vista) {
  const nav = document.querySelector('nav')
  if (!nav) return

  switch (vista) {

    case 'inicio':
      nav.innerHTML = `
        <strong style="font-size:15px;font-weight:700;letter-spacing:-0.3px;">Mi Suite Web</strong>
        <div class="nav-right" style="gap:10px;">
          <a href="#" onclick="cerrarSesion()" style="font-size:13px;">Sign out</a>
          <div class="theme-toggle" id="theme-toggle" onclick="toggleTheme()" style="width:32px;height:18px;flex-shrink:0;">
            <div class="theme-toggle-thumb"></div>
          </div>
        </div>
      `
      aplicarTheme()
      break

    case 'notas':
      nav.innerHTML = `
        <a href="#" onclick="mobileNavSelect('inicio')"
          style="color:var(--accent);font-size:14px;text-decoration:none;font-family:var(--font);white-space:nowrap;flex-shrink:0;">
          ‹ Home
        </a>
        <strong style="font-size:13px;flex:1;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 8px;">
          ${libretaActual ? descifrar(libretaActual.name_enc) : 'Notebooks'}
        </strong>
        <button onclick="nuevaNota()"
          style="background:var(--accent);color:#fff;border:none;border-radius:99px;padding:4px 14px;font-size:12px;font-family:var(--font);cursor:pointer;white-space:nowrap;flex-shrink:0;">
          + Note
        </button>
      `
      break

    case 'editor':
      nav.innerHTML = `
        <a href="#" onclick="guardarYRegresar()"
          style="color:var(--accent);font-size:14px;text-decoration:none;font-family:var(--font);white-space:nowrap;flex-shrink:0;">
          ‹ Home
        </a>
        <strong style="font-size:13px;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 8px;"
          id="nota-titulo-nav">Note</strong>
        <button onclick="guardarYRegresar()"
          style="background:var(--accent);color:#fff;border:none;border-radius:99px;padding:4px 14px;font-size:12px;font-family:var(--font);cursor:pointer;white-space:nowrap;flex-shrink:0;">
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
          style="color:var(--accent);font-size:14px;text-decoration:none;font-family:var(--font);white-space:nowrap;flex-shrink:0;">
          ‹ Home
        </a>
        <strong style="font-size:13px;flex:1;text-align:center;">To-Do's</strong>
        <button onclick="agregarTodoMobile()"
          style="background:var(--accent);color:#fff;border:none;border-radius:99px;padding:4px 14px;font-size:12px;font-family:var(--font);cursor:pointer;white-space:nowrap;flex-shrink:0;">
          + Task
        </button>
      `
      break

    case 'attachments':
      nav.innerHTML = `
        <a href="#" onclick="cerrarAttachments()"
          style="color:var(--accent);font-size:14px;text-decoration:none;font-family:var(--font);white-space:nowrap;flex-shrink:0;">
          ‹ Back
        </a>
        <strong style="font-size:13px;flex:1;text-align:center;">Attachments</strong>
        <button onclick="subirAttachment()"
          style="background:var(--accent);color:#fff;border:none;border-radius:99px;padding:4px 14px;font-size:12px;font-family:var(--font);cursor:pointer;white-space:nowrap;flex-shrink:0;">
          + Add
        </button>
      `
      break

    case 'papelera':
      nav.innerHTML = `
        <a href="#" onclick="mobileNavSelect('inicio')"
          style="color:var(--accent);font-size:14px;text-decoration:none;font-family:var(--font);white-space:nowrap;flex-shrink:0;">
          ‹ Home
        </a>
        <strong style="font-size:13px;flex:1;text-align:center;">Trash</strong>
        <span style="width:60px;flex-shrink:0;"></span>
      `
      break
  }
}

// ==================== ACCIONES MOBILE ====================

async function guardarYRegresar() {
  if (notaActual && window._hayaCambios) {
    await guardarNota()
  }
  mobileNavSelect('inicio')
}

function agregarTodoMobile() {
  const input = document.getElementById('todo-input')
  if (!input) return

  // Show input temporarily
  const addBar = document.getElementById('todo-add-bar')
  if (addBar) {
    addBar.style.display = 'flex'
    input.focus()
    // Hide again after blur
    input.addEventListener('blur', () => {
      setTimeout(() => { if (addBar) addBar.style.display = 'none' }, 200)
    }, { once: true })
  }
}

// ==================== PATCH SIDEBAR MOBILE ====================

function patchTodosSidebar() {
  const header = document.getElementById('todos-summary-header')
  const colsList = document.getElementById('todos-cols-list')

  if (header) {
    header.onclick = function() {
      if (esMobile()) mobileNavSelect('todos')
      else if (typeof abrirTodosGlobal === 'function') abrirTodosGlobal()
    }
  }

  if (colsList) {
    colsList.querySelectorAll('.todos-col-row').forEach(row => {
      row.onclick = function() {
        if (esMobile()) mobileNavSelect('todos')
        else if (typeof abrirTodosGlobal === 'function') abrirTodosGlobal()
      }
    })
  }
}

function patchPapeleraSidebar() {
  const item = document.querySelector('.papelera-item')
  if (item) {
    item.onclick = function() {
      if (esMobile()) mobileNavSelect('papelera')
      else abrirPapelera()
    }
  }
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
      <strong>Mi Suite Web</strong>
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
  const attScreen = document.getElementById('attachments-screen')

  if (sidebar) sidebar.style.cssText = 'display:flex;width:220px;height:100%;flex:none;border-right:1px solid var(--border);'
  if (notasPanel) notasPanel.style.cssText = 'display:flex;width:260px;height:100%;flex:none;border-right:1px solid var(--border);'
  if (editorPanel) editorPanel.style.cssText = 'display:flex;flex:1;height:100%;min-width:0;'
  if (todosPanel) todosPanel.style.cssText = 'display:none;'
  if (addBar) addBar.style.display = 'flex'
  if (attScreen) attScreen.classList.remove('open')

  aplicarTheme()
}

// ==================== SIDEBAR INICIO MOBILE STYLING ====================

function aplicarEstiloInicioMobile() {
  if (!esMobile()) return

  const sidebar = document.getElementById('sidebar')
  if (!sidebar) return

  // Left-align title area
  const header = sidebar.querySelector('.sidebar-header')
  if (header) {
    header.style.justifyContent = 'flex-start'
    header.style.padding = '10px 14px 8px'
  }
}

// ==================== CSS MOBILE ====================

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
      flex: 1;
      text-align: left;
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
    .todos-body { -webkit-overflow-scrolling: touch; }
    .todos-panel { position: relative; z-index: 10; }
    .sidebar-footer { padding-bottom: max(12px, env(safe-area-inset-bottom)); }

    .libretas-wrap { flex: none; max-height: 42vh; }
    .todos-summary-wrap { flex: none; }

    /* Sidebar sections — icon only, no text labels */
    .sidebar-section-label { display: none; }
    .sidebar-section { padding: 6px 10px 2px; }

    /* Left-align nav title on home */
    nav strong { text-align: left !important; }

    /* Attachments screen full height on mobile */
    .attachments-screen {
      top: 52px;
      position: fixed;
      z-index: 100;
    }

    .attachments-body {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    }
  }

  @media (max-width: 768px) and (orientation: landscape) {
    .editor-area { padding-bottom: 60px; }
    .libretas-wrap { max-height: 28vh; }
  }
`
document.head.appendChild(mobileNavStyle)

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', () => {
  iniciarMobileNav()
  aplicarEstiloInicioMobile()
  setTimeout(() => {
    patchTodosSidebar()
    patchPapeleraSidebar()
  }, 1500)
})