// Configuración Supabase
const SUPABASE_URL = 'https://kiusmfwdgsodqmoqpaxr.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdXNtZndkZ3NvZHFtb3FwYXhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMjEyNDgsImV4cCI6MjA5MDU5NzI0OH0.MJM0fYZdzBytsJjBYo1GOcFo2jK3_EUZ0j2TqcsxQSw'

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

// Mostrar mensajes
function mostrarError(msg) {
  const el = document.getElementById('msg-error')
  if (!el) return
  el.textContent = msg
  el.style.display = 'block'
  setTimeout(() => el.style.display = 'none', 4000)
}

function mostrarOk(msg) {
  const el = document.getElementById('msg-ok')
  if (!el) return
  el.textContent = msg
  el.style.display = 'block'
  setTimeout(() => el.style.display = 'none', 4000)
}

// Iniciar sesión
async function iniciarSesion() {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value

  const { error } = await db.auth.signInWithPassword({ email, password })

  if (error) {
    mostrarError('Correo o contraseña incorrectos.')
  } else {
    window.location.href = '../index.html'
  }
}

// Registrarse
async function registrarse() {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value

  if (password.length < 8) {
    mostrarError('La contraseña debe tener al menos 8 caracteres.')
    return
  }

  const { error } = await db.auth.signUp({ email, password })

  if (error) {
    mostrarError('Error al crear cuenta: ' + error.message)
  } else {
    mostrarOk('Cuenta creada. Revisa tu correo para confirmar.')
  }
}

// Cerrar sesión
async function cerrarSesion() {
  await db.auth.signOut()
  window.location.href = 'pages/login.html'
}

// Verificar sesión activa
async function verificarSesion() {
  const { data } = await db.auth.getSession()
  return data.session
}

// Dark mode
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const newTheme = isDark ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', newTheme)
  localStorage.setItem('theme', newTheme)
  const toggle = document.getElementById('theme-toggle')
  const label = document.getElementById('theme-label')
  if (toggle) toggle.classList.toggle('on', newTheme === 'dark')
  if (label) label.textContent = newTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'
}

function aplicarTheme() {
  const theme = localStorage.getItem('theme') || 'light'
  document.documentElement.setAttribute('data-theme', theme)
  const toggle = document.getElementById('theme-toggle')
  const label = document.getElementById('theme-label')
  if (toggle) toggle.classList.toggle('on', theme === 'dark')
  if (label) label.textContent = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'
}

document.addEventListener('DOMContentLoaded', aplicarTheme)

function cifrar(texto) {
  if (!texto) return ''
  return btoa(unescape(encodeURIComponent(texto)))
}

function descifrar(texto) {
  if (!texto) return ''
  try { return decodeURIComponent(escape(atob(texto))) } catch { return texto }
}

function formatearFecha(fecha) {
  if (!fecha) return ''
  return new Date(fecha).toLocaleDateString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}