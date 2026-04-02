// ==================== MOBILE NAVIGATION ====================

const MOBILE_BREAKPOINT = 768

let mobileVista = 'inicio'

function esMobile() {
  return window.innerWidth <= MOBILE_BREAKPOINT
}

function iniciarMobileNav() {
  if (!esMobile()) return
  aplicarVistaMobile('inicio')
  ajustarAlturaViewport()
}

// Corrige el problema de 100vh en iOS Safari
function ajustarAlturaViewport() {
  const vh = window.innerHeight * 0.01
  document.documentElement.style.setProperty('--vh', `${vh}px`)
}

window.addEventListener('resize', () => {
  ajustarAlturaViewport()
  if (!esMobile()) {
    restaurarDesktop()
  } else {
    aplicarVistaMobile(mobileVista)
  }
})

window.addEventListener('orientationchange', () => {
  setTimeout(ajustarAlturaViewport, 100)
})

// ==================== VISTAS MOBILE ====================

function mobileNavSelect(vista) {
  if (!esMobile()) return

  mobileVista = vista

  // Actualizar barra inferior
  document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'))
  const navItem = document.getElementById(`mnav-${vista}`)
  if (navItem) navItem.classList.add('active')

  aplicarVistaMobile(vista)
}

function aplicarVistaMobile(vista) {
  const sidebar = document.getElementById('sidebar')
  const notasPanel = document.getElementById('notas-panel')
  const editorPanel = document.getElementById('editor-panel')
  const todosPanel = document.getElementById('todos-panel')
  const resizers = document.querySelectorAll('.resizer')

  // Ocultar resizers en mobile
  resizers.forEach(r => r.style.display = 'none')

  // Ocultar todo primero
  if (sidebar) sidebar.style.display = 'none'
  if (notasPanel) notasPanel.style.display = 'none'
  if (editorPanel) editorPanel.style.display = 'none'
  if (todosPanel) todosPanel.style.display = 'none'

  switch (vista) {
    case 'inicio':
      if (sidebar) {
        sidebar.style.display = 'flex'
        sidebar.style.width = '100%'
        sidebar.style.height = 'auto'
        sidebar.style.flex = 'none'
        sidebar.style.maxHeight = 'calc(var(--vh, 1vh) * 100 - 52px - 56px)'
        sidebar.style.overflowY = 'auto'
      }
      actualizarMobileNav(['mnav-inicio', 'mnav-todos', 'mnav-papelera'])
      break

    case 'notas':
      if (notasPanel) {
        notasPanel.style.display = 'flex'
        notasPanel.style.width = '100%'
        notasPanel.style.flex = 'none'
        notasPanel.style.height = 'calc(var(--vh, 1vh) * 100 - 52px - 56px)'
      }
      actualizarMobileNav(['mnav-inicio'])
      break

    case 'editor':
      if (editorPanel) {
        editorPanel.style.display = 'flex'
        editorPanel.style.width = '100%'
        editorPanel.style.flex = 'none'
        editorPanel.style.height = 'calc(var(--vh, 1vh) * 100 - 52px - 56px)'
      }
      actualizarMobileNav(['mnav-inicio'])
      break

    case 'todos':
      if (todosPanel) {
        todosPanel.style.display = 'flex'
        todosPanel.style.width = '100%'
        todosPanel.style.flex = 'none'
        todosPanel.style.height = 'calc(var(--vh, 1vh) * 100 - 52px - 56px)'
        todosPanel.style.borderLeft = 'none'
      }
      actualizarMobileNav(['mnav-inicio', 'mnav-todos', 'mnav-papelera'])
      cargarTodosGlobal().then(() => renderTodos())
      break

    case 'papelera':
      actualizarMobileNav(['mnav-inicio', 'mnav-todos', 'mnav-papelera'])
      abrirPapelera()
      break
  }
}

function actualizarMobileNav(activos) {
  document.querySelectorAll('.mobile-nav-item').forEach(el => {
    el.classList.remove('active')
  })
  activos.forEach(id => {
    const el = document.getElementById(id)
    if (el) el.classList.add('active')
  })
}

// ==================== BACK NAVIGATION ====================

function mobileBack() {
  switch (mobileVista) {
    case 'editor':
      mobileNavSelect('notas')
      break
    case 'notas':
      mobileNavSelect('inicio')
      break
    default:
      mobileNavSelect('inicio')
  }
}

// Swipe back gesture
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

  // Swipe derecha desde el borde izquierdo = back
  if (dx > 80 && dy < 50 && touchStartX < 30) {
    mobileBack()
  }
}, { passive: true })

// ==================== RESTAURAR DESKTOP ====================

function restaurarDesktop() {
  const sidebar = document.getElementById('sidebar')
  const notasPanel = document.getElementById('notas-panel')
  const editorPanel = document.getElementById('editor-panel')
  const todosPanel = document.getElementById('todos-panel')

  if (sidebar) {
    sidebar.style.display = 'flex'
    sidebar.style.width = '220px'
    sidebar.style.height = '100%'
    sidebar.style.flex = ''
    sidebar.style.maxHeight = ''
    sidebar.style.overflowY = ''
  }

  if (notasPanel) {
    notasPanel.style.display = 'flex'
    notasPanel.style.width = '260px'
    notasPanel.style.height = '100%'
    notasPanel.style.flex = ''
  }

  if (editorPanel) {
    editorPanel.style.display = 'flex'
    editorPanel.style.width = ''
    editorPanel.style.height = '100%'
    editorPanel.style.flex = '1'
  }
}

// ==================== MOBILE NAV CSS ====================

const mobileNavStyle = document.createElement('style')
mobileNavStyle.textContent = `
  .mobile-nav {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 56px;
    background: var(--surface);
    border-top: 1px solid var(--border);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    z-index: 200;
    justify-content: space-around;
    align-items: center;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .mobile-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 20px;
    cursor: pointer;
    border-radius: 10px;
    transition: background 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-nav-item:active { background: var(--bg3); }

  .mobile-nav-icon {
    font-size: 20px;
    line-height: 1;
  }

  .mobile-nav-label {
    font-size: 10px;
    font-weight: 500;
    color: var(--text3);
    font-family: var(--font);
  }

  .mobile-nav-item.active .mobile-nav-label { color: var(--accent); }

  @media (max-width: 768px) {
    .mobile-nav { display: flex; }

    nav { padding: 0 16px; }

    .notas-layout {
      flex-direction: column;
      height: auto;
      overflow: visible;
      padding-bottom: 56px;
    }

    .sidebar {
      width: 100% !important;
      border-right: none;
      border-bottom: 1px solid var(--border);
    }

    .notas-panel {
      width: 100% !important;
      border-right: none;
      border-bottom: 1px solid var(--border);
    }

    .editor-panel {
      width: 100% !important;
      min-height: calc(var(--vh, 1vh) * 100 - 52px - 56px);
    }

    .todos-panel {
      width: 100% !important;
      border-left: none;
      border-top: 1px solid var(--border);
    }

    .editor-toolbar {
      overflow-x: auto;
      flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
    }

    .editor-toolbar::-webkit-scrollbar { display: none; }

    .editor-titulo { font-size: 18px; padding: 14px 16px 6px; }
    .editor-area { padding: 6px 16px 16px; font-size: 15px; }
    .editor-footer { padding: 8px 16px; }

    .kanban-col { min-width: 140px; }
    .todos-body { -webkit-overflow-scrolling: touch; }
  }

  @media (max-width: 768px) and (orientation: landscape) {
    .mobile-nav { height: 44px; }
    .mobile-nav-icon { font-size: 16px; }
    .mobile-nav-label { font-size: 9px; }
  }
`
document.head.appendChild(mobileNavStyle)

// Iniciar al cargar
document.addEventListener('DOMContentLoaded', iniciarMobileNav)