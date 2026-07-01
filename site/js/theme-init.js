(function () {
  var KEY = 'airdrop_theme_active'
  var PRESETS = {
    'light-gray': {
      bg: '#f0f2f5', bgCard: '#ffffff', bgElevated: '#e8eaed',
      border: 'rgba(0,0,0,0.08)', text: '#1a1f1c', textMuted: '#5c6560',
      accent: '#3d6b4f', accentHover: '#4a7c59', accentGlow: 'rgba(61,107,79,0.25)',
      success: '#2d8a4e', danger: '#c45c5c',
      gradientFrom: '#4a7c59', gradientMid: '#5d9469', gradientTo: '#7aab82',
      headerBg: 'rgba(255,255,255,0.55)',
    },
    'dark-green': {
      bg: '#0a0f0d', bgCard: '#141a17', bgElevated: '#1c2420',
      border: 'rgba(140,170,150,0.14)', text: '#eef2ef', textMuted: '#8a9a90',
      accent: '#4a7c59', accentHover: '#5d9469', accentGlow: 'rgba(74,124,89,0.4)',
      success: '#5cb87a', danger: '#c45c5c',
      gradientFrom: '#3d5a47', gradientMid: '#4a7c59', gradientTo: '#6b8f72',
      headerBg: 'rgba(10,15,13,0.42)',
    },
  }

  var active = 'light-gray'
  try { active = localStorage.getItem(KEY) || 'light-gray' } catch (e) { /* private mode */ }
  var p = PRESETS[active] || PRESETS['light-gray']
  var root = document.documentElement

  root.style.setProperty('--bg', p.bg)
  root.style.setProperty('--bg-card', p.bgCard)
  root.style.setProperty('--bg-elevated', p.bgElevated)
  root.style.setProperty('--border', p.border)
  root.style.setProperty('--text', p.text)
  root.style.setProperty('--text-muted', p.textMuted)
  root.style.setProperty('--accent', p.accent)
  root.style.setProperty('--accent-hover', p.accentHover)
  root.style.setProperty('--accent-glow', p.accentGlow)
  root.style.setProperty('--success', p.success)
  root.style.setProperty('--danger', p.danger)
  root.style.setProperty('--gradient-from', p.gradientFrom)
  root.style.setProperty('--gradient-mid', p.gradientMid)
  root.style.setProperty('--gradient-to', p.gradientTo)
  root.style.setProperty('--gradient', 'linear-gradient(135deg, ' + p.gradientFrom + ' 0%, ' + p.gradientMid + ' 50%, ' + p.gradientTo + ' 100%)')
  root.style.setProperty('--header-bg', p.headerBg)
  root.dataset.theme = active

  function unlockScroll() {
    if (document.body) document.body.style.overflow = ''
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', unlockScroll)
  } else {
    unlockScroll()
  }
  window.addEventListener('pageshow', unlockScroll)

  if (!document.querySelector('link[rel="icon"]')) {
    var icon = document.createElement('link')
    icon.rel = 'icon'
    icon.type = 'image/png'
    icon.href = '/assets/logo.png'
    document.head.appendChild(icon)

    var apple = document.createElement('link')
    apple.rel = 'apple-touch-icon'
    apple.href = '/assets/logo.png'
    document.head.appendChild(apple)
  }
})()
