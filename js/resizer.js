function iniciarResizers() {
  configurarResizer('resizer-1', 'sidebar', 'notas-panel')
  configurarResizer('resizer-2', 'notas-panel', 'editor-panel')
  configurarResizer('resizer-3', 'editor-panel', 'todos-panel')
}

function configurarResizer(resizerId, panelIzqId, panelDerId) {
  const resizer = document.getElementById(resizerId)
  const panelIzq = document.getElementById(panelIzqId)
  const panelDer = document.getElementById(panelDerId)
  if (!resizer || !panelIzq || !panelDer) return

  let startX, startWidthIzq

  function iniciarDrag(clientX) {
    startX = clientX
    startWidthIzq = panelIzq.offsetWidth
    resizer.classList.add('resizing')
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  function moverDrag(clientX) {
    const dx = clientX - startX
    const newWidth = startWidthIzq + dx
    const minIzq = parseInt(getComputedStyle(panelIzq).minWidth) || 160
    const maxIzq = parseInt(getComputedStyle(panelIzq).maxWidth) || 600
    const minDer = parseInt(getComputedStyle(panelDer).minWidth) || 200
    const espacioDisponible = panelIzq.offsetWidth + panelDer.offsetWidth
    if (newWidth < minIzq || newWidth > maxIzq) return
    if (espacioDisponible - newWidth < minDer) return
    panelIzq.style.width = newWidth + 'px'
    panelIzq.style.flex = 'none'
  }

  function terminarDrag() {
    resizer.classList.remove('resizing')
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  resizer.addEventListener('mousedown', e => {
    iniciarDrag(e.clientX)
    const onMove = e => moverDrag(e.clientX)
    const onUp = () => {
      terminarDrag()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })

  resizer.addEventListener('touchstart', e => {
    iniciarDrag(e.touches[0].clientX)
    const onMove = e => moverDrag(e.touches[0].clientX)
    const onUp = () => {
      terminarDrag()
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onUp)
    }
    document.addEventListener('touchmove', onMove)
    document.addEventListener('touchend', onUp)
  })
}

document.addEventListener('DOMContentLoaded', iniciarResizers)