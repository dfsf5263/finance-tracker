'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { getCookie, setCookie } from '@/lib/utils'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    // Get theme from cookie on mount
    const savedTheme = getCookie('theme') as Theme | null
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    // Save theme to cookie whenever it changes
    setCookie('theme', theme)

    // Apply theme class to html element
    const root = window.document.documentElement

    // Remove dark class first
    root.classList.remove('dark')

    // Add dark class if theme is dark
    if (theme === 'dark') {
      root.classList.add('dark')
    }
  }, [theme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
