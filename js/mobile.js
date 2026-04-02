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

function aplicarVistaMobile(vista) {
  const sidebar = document.getElementById('sidebar')
  const notasPanel = document.getElementById('notas-panel')
  const editorPanel = document.getElementById('editor-panel')
  const todosPanel = document.getElementById('todos-panel')
  const mobileNav = document.getElementById('mobile-nav')
  const resizers = document.querySelectorAll('.resizer')

  resizers.forEach(r => r.style.display = 'none')

  // Ocultar todo
  ;[sidebar, notasPanel, editorPanel, todosPanel].forEach(el => {
    if (el) el.style.display = 'none'
  })

  const alturaContenido = 'calc(var(--vh, 1vh) * 100 - 52px)'

  switch (vista) {

    case 'inicio':
      // Sin barra inferior en inicio
      if (mobileNav) mobileNav.style.display = 'none'
      if (sidebar) {
        sidebar.style.display = 'flex'
        sidebar.style.width = '100%'
        sidebar.style.height = alturaContenido
        sidebar.style.flex = 'none'
        sidebar.style.overflowY = 'auto'
        sidebar.style.borderRight = 'none'
        sidebar.style.borderBottom = 'none'
      }
      actualizarNavbarMobile('inicio')
      break

    case 'notas':
      if (mobileNav) mobileNav.style.display = 'none'
      if (notasPanel) {
        notasPanel.style.display = 'flex'
        notasPanel.style.width = '100%'
        notasPanel.style.height = alturaContenido
        notasPanel.style.flex = 'none'
        notasPanel.style.borderRight = 'none'
      }
      actualizarNavbarMobile('notas')
      break

    case 'editor':
      if (mobileNav) mobileNav.style.display = 'none'
      if (editorPanel) {
        editorPanel.style.display = 'flex'
        editorPanel.style.width = '100%'
        editorPanel.style.height = alturaContenido
        editorPanel.style.flex = 'none'
      }
      actualizarNavbarMobile('editor')
      break

    case 'todos':
      if (mobileNav) mobileNav.style.display = 'none'
      if (todosPanel) {
        todosPanel.style.display = 'flex'
        todosPanel.style.width = '100%'
        todosPanel.style.height = alturaContenido
        todosPanel.style.flex = 'none'
        todosPanel.style.borderLeft = 'none'
      }
      actualizarNavbarMobile('todos')
      cargarTodosGlobal().then(() => renderTodos())
      break

    case 'papelera':
      if (mobileNav) mobileNav.style.display = 'none'
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
        <strong>Mi Suite Web</strong>
        <div class="nav-right">
          <a href="#" onclick="cerrarSesion()">Salir</a>
          <div class="theme-toggle" id="theme-toggle" onclick="toggleTheme()" style="width:32px;height:18px;">
            <div class="theme-toggle-thumb"></div>
          </div>
        </div>
      `
      aplicarTheme()
      break

    case 'notas':
      nav.innerHTML = `
        <a href="#" onclick="mobileNavSelect('inicio')" style="color:var(--accent);font-size:14px;text-decoration:none;">‹ Inicio</a>
        <strong id="libreta-nombre-nav">${libretaActual ? descifrar(libretaActual.name_enc) : 'Notas'}</strong>
        <button onclick="nuevaNota()" style="background:var(--accent);color:#fff;border:none;border-radius:99px;padding:4px 12px;font-size:12px;font-family:var(--font);cursor:pointer;">+ Nota</button>
      `
      break

    case 'editor':
      nav.innerHTML = `
        <a href="#" onclick="guardarYRegresar()" style="color:var(--accent);font-size:14px;text-decoration:none;">‹ Notas</a>
        <strong style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;" id="nota-titulo-nav"></strong>
        <button onclick="guardarYRegresar()" style="background:var(--accent);color:#fff;border:none;border-radius:99px;padding:4px 12px;font-size:12px;font-family:var(--font);cursor:pointer;">Save</button>
      `
      // Actualizar título
      setTimeout(() => {
        const tituloEl = document.getElementById('nota-titulo-nav')
        const tituloInput = document.getElementById('nota-titulo')
        if (tituloEl && tituloInput) tituloEl.textContent = tituloInput.value || 'New note'
      }, 100)
      break

    case 'todos':
      nav.innerHTML = `
        <a href="#" onclick="mobileNavSelect('inicio')" style="color:var(--accent);font-size:14px;text-decoration:none;">‹ Inicio</a>
        <strong>To-Do's</strong>
        <button onclick="agregarTodo()" style="background:var(--accent);color:#fff;border:none;border-radius:99px;padding:4px 12px;font-size:12px;font-family:var(--font);cursor:pointer;">+ Nueva</button>
      `
      break

    case 'papelera':
      nav.innerHTML = `
        <a href="#" onclick="mobileNavSelect('inicio')" style="color:var(--accent);font-size:14px;text-decoration:none;">‹ Inicio</a>
        <strong>Papelera</strong>
        <span></span>
      `
      break
  }
}

// ==================== GUARDAR Y REGRESAR ====================

async function guardarYRegresar() {
  if (notaActual && window._hayaCambios) {
    await guardarNota()
  }
  mobileNavSelect('notas')
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
        <a href="../index.html">Inicio</a>
        <a href="calendario.html">Calendario</a>
        <a href="peliculas.html">Películas</a>
        <a href="#" onclick="cerrarSesion()">Salir</a>
      </div>
    `
  }

  const mobileNav = document.getElementById('mobile-nav')
  if (mobileNav) mobileNav.style.display = 'none'

  const sidebar = document.getElementById('sidebar')
  const notasPanel = document.getElementById('notas-panel')
  const editorPanel = document.getElementById('editor-panel')

  if (sidebar) {
    sidebar.style.cssText = 'display:flex;width:220px;height:100%;flex:none;border-right:1px solid var(--border);border-bottom:none;overflow:hidden;'
  }
  if (notasPanel) {
    notasPanel.style.cssText = 'display:flex;width:260px;height:100%;flex:none;border-right:1px solid var(--border);'
  }
  if (editorPanel) {
    editorPanel.style.cssText = 'display:flex;flex:1;height:100%;min-width:0;'
  }

  aplicarTheme()
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
    }

    nav strong {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.3px;
    }

    .notas-layout {
      flex-direction: column;
      height: auto;
      overflow: visible;
    }

    .sidebar {
      width: 100% !important;
      border-right: none !important;
    }

    .notas-panel {
      width: 100% !important;
      border-right: none !important;
    }

    .editor-panel {
      width: 100% !important;
    }

    .todos-panel {
      width: 100% !important;
      border-left: none !important;
    }

    .editor-toolbar {
      overflow-x: auto;
      flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }

    .editor-toolbar::-webkit-scrollbar { display: none; }

    .editor-titulo { font-size: 18px; padding: 14px 16px 6px; }
    .editor-area { padding: 6px 16px 120px; font-size: 15px; -webkit-overflow-scrolling: touch; }
    .editor-footer { padding: 8px 16px; }

    .editor-footer-actions .btn:nth-child(1),
    .editor-footer-actions .btn:nth-child(2) { display: none; }

    .kanban-col { min-width: 140px; }
    .todos-body { -webkit-overflow-scrolling: touch; }

    .sidebar-footer { padding-bottom: max(12px, env(safe-area-inset-bottom)); }
  }

  @media (max-width: 768px) and (orientation: landscape) {
    .editor-area { padding-bottom: 80px; }
  }
`
document.head.appendChild(mobileNavStyle)

document.addEventListener('DOMContentLoaded', iniciarMobileNav)