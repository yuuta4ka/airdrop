const VAR_MAP = {
  bg: '--bg',
  bgCard: '--bg-card',
  bgElevated: '--bg-elevated',
  border: '--border',
  text: '--text',
  textMuted: '--text-muted',
  accent: '--accent',
  accentHover: '--accent-hover',
  accentGlow: '--accent-glow',
  success: '--success',
  danger: '--danger',
  gradientFrom: '--gradient-from',
  gradientMid: '--gradient-mid',
  gradientTo: '--gradient-to',
  headerBg: '--header-bg',
}

export function applyTheme(themeConfig) {
  if (!themeConfig?.presets || !themeConfig.active) return
  const preset = themeConfig.presets[themeConfig.active]
  if (!preset) return

  const root = document.documentElement
  Object.entries(VAR_MAP).forEach(([key, cssVar]) => {
    if (preset[key] !== undefined) root.style.setProperty(cssVar, preset[key])
  })

  root.style.setProperty(
    '--gradient',
    `linear-gradient(135deg, ${preset.gradientFrom} 0%, ${preset.gradientMid} 50%, ${preset.gradientTo} 100%)`
  )

  document.body.dataset.theme = themeConfig.active
  document.documentElement.dataset.theme = themeConfig.active
  try {
    localStorage.setItem('airdrop_theme_active', themeConfig.active)
  } catch { /* private mode */ }
}

export function getThemeVarKeys() {
  return Object.keys(VAR_MAP)
}

export const THEME_LABELS = {
  bg: 'Фон страницы',
  bgCard: 'Фон карточек',
  bgElevated: 'Фон кнопок',
  border: 'Границы',
  text: 'Текст',
  textMuted: 'Приглушённый текст',
  accent: 'Акцент',
  accentHover: 'Акцент (hover)',
  accentGlow: 'Свечение',
  success: 'Успех / наличие',
  danger: 'Ошибка / скидка',
  gradientFrom: 'Градиент (начало)',
  gradientMid: 'Градиент (середина)',
  gradientTo: 'Градиент (конец)',
  headerBg: 'Фон шапки',
}
