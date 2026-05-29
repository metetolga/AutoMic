import { Link } from '@tanstack/react-router'
import { Mic2, Moon, Sun } from 'lucide-react'
import { useDarkMode } from '../lib/useDarkMode'

export function Navbar() {
  const [dark, setDark] = useDarkMode()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/95">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Mic2 className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight dark:text-gray-100">AutoMic</span>
        </div>

        <nav className="flex items-center gap-4">
          <button
            onClick={() => setDark(!dark)}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link
            to="/admin"
            className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            Admin
          </Link>
          <Link
            to="/"
            className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#8500D8]"
          >
            Add Songs
          </Link>
        </nav>
      </div>
    </header>
  )
}
