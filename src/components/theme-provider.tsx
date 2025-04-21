"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect } from "react"

type Theme = "light" | "dark"

type ThemeContextType = {
    theme: Theme
    setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
    theme: "light",
    setTheme: () => { },
})

export function ThemeProvider({
    attribute,
    defaultTheme,
    enableSystem,
    disableTransitionOnChange,
    children,
}: {
    attribute: string
    defaultTheme: Theme
    enableSystem: boolean
    disableTransitionOnChange: boolean
    children: React.ReactNode
}) {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window !== "undefined") {
            const storedTheme = localStorage.getItem("theme") as Theme | null
            if (storedTheme) {
                return storedTheme
            } else if (enableSystem) {
                return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
            }
        }
        return defaultTheme
    })

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("theme", theme)
            document.documentElement.setAttribute(attribute, theme)
        }
    }, [theme, attribute])

    return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider")
    }
    return context
}
