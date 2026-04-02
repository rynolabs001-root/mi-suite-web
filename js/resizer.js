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

  let startX, startWidthIzq, startWidthDer

  resizer.addEventListener('mousedown', e => {
    startX = e.clientX
    startWidthIzq = panelIzq.offsetWidth
    startWidthDer = panelDer.offsetWidth
    resizer.classList.add('resizing')
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  })

  // Touch support para mobile
  resizer.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX
    startWidthIzq = panelIzq.offsetWidth
    startWidthDer = panelDer.offsetWidth
    resizer.classList.add('resizing')

    document.addEventListener('touchmove', onTouchMove)
    document.addEventListener('touchend', onMouseUp)
  })

  function onMouseMove(e) {
    const dx = e.clientX - startX
    const newWidthIzq = startWidthIzq + dx

    const minIzq = parseInt(getComputedStyle(panelIzq).minWidth) || 160
    const maxIzq = parseInt(getComputedStyle(panelIzq).maxWidth) || 600
    const minDer = parseInt(getComputedStyle(panelDer).minWidth) || 200

    if (newWidthIzq < minIzq || newWidthIzq > maxIzq) return
    if (startWidthDer - dx < minDer) return

    panelIzq.style.width = newWidthIzq + 'px'
    panelIzq.style.flex = 'none'
  }

  function onTouchMove(e) {
    const dx = e.touches[0].clientX - startX
    const newWidthIzq = startWidthIzq + dx
    const minIzq = parseInt(getComputedStyle(panelIzq).minWidth) || 160
    const maxIzq = parseInt(getComputedStyle(panelIzq).maxWidth) || 600
    const minDer = parseInt(getComputedStyle(panelDer).minWidth) || 200
    if (newWidthIzq < minIzq || newWidthIzq > maxIzq) return
    if (startWidthDer - dx < minDer) return
    panelIzq.style.width = newWidthIzq + 'px'
    panelIzq.style.flex = 'none'
  }

  function onMouseUp() {
    resizer.classList.remove('resizing')
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('touchmove', onTouchMove)
    document.removeEventListener('touchend', onMouseUp)
  }
}

document.addEventListener('DOMContentLoaded', iniciarResizers)