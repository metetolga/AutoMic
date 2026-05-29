import { useEffect, useState } from 'react'

export function useDarkMode() {
  const [dark, setDark] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(stored === 'dark' || (!stored && prefersDark))
    setInitialized(true)
  }, [])

  useEffect(() => {
    if (!initialized) return
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark, initialized])

  return [dark, setDark] as const
}
