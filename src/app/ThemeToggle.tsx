import { useEffect, useState } from 'react'
import { Moon, Sun, SunMoon } from 'lucide-react'

type ThemePreference = 'AUTO' | 'LIGHT' | 'DARK'

const themeStorageKey = 'treenikompassi.theme'

function storedTheme(): ThemePreference {
  const value = localStorage.getItem(themeStorageKey)
  if (value === 'AUTO' || value === 'LIGHT' || value === 'DARK') return value
  return 'AUTO'
}

function applyTheme(preference: ThemePreference) {
  const dark =
    preference === 'DARK' ||
    (preference === 'AUTO' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [preference, setPreference] = useState(storedTheme)

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => applyTheme(preference)
    update()
    localStorage.setItem(themeStorageKey, preference)
    if (preference === 'AUTO') media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [preference])

  const next = () => {
    setPreference((current) =>
      current === 'AUTO' ? 'LIGHT' : current === 'LIGHT' ? 'DARK' : 'AUTO',
    )
  }
  const Icon = preference === 'AUTO' ? SunMoon : preference === 'LIGHT' ? Sun : Moon
  const modeLabel =
    preference === 'AUTO' ? 'automaattinen' : preference === 'LIGHT' ? 'vaalea' : 'tumma'
  const actionLabel = `Teema: ${modeLabel}. Vaihda seuraavaan tilaan.`

  return (
    <button
      className="icon-button"
      type="button"
      onClick={next}
      aria-label={actionLabel}
      title={actionLabel}
    >
      <Icon aria-hidden="true" size={19} />
    </button>
  )
}
