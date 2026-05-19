import { Link } from '@tanstack/react-router'
import { Mic2 } from 'lucide-react'

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Mic2 className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">händlebar</span>
        </div>

        <nav className="flex items-center gap-4">
          <Link
            to="/admin"
            className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
          >
            Admin
          </Link>
          <Link
            to="/"
            className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            Add Songs
          </Link>
        </nav>
      </div>
    </header>
  )
}
