import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type ThemePreference = 'LIGHT' | 'DARK'

const themeStorageKey = 'treenikompassi.theme'

function storedTheme(): ThemePreference {
  const value = localStorage.getItem(themeStorageKey)
  if (value === 'LIGHT' || value === 'DARK') return value
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'DARK' : 'LIGHT'
}

function applyTheme(preference: ThemePreference) {
  const dark = preference === 'DARK'
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [preference, setPreference] = useState(storedTheme)

  useEffect(() => {
    applyTheme(preference)
    localStorage.setItem(themeStorageKey, preference)
  }, [preference])

  const next = () => {
    setPreference((current) => (current === 'LIGHT' ? 'DARK' : 'LIGHT'))
  }
  const Icon = preference === 'LIGHT' ? Moon : Sun
  const actionLabel =
    preference === 'LIGHT' ? 'Vaihda tummaan teemaan' : 'Vaihda vaaleaan teemaan'

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
