'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext({});

export function ThemeProvider({ children }) {
    const [isDark, setIsDark] = useState(false);

    // Load preference on mount
    useEffect(() => {
        const saved = localStorage.getItem('eznr_theme');
        // Also respect OS preference if no saved choice
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const dark = saved ? saved === 'dark' : prefersDark;
        setIsDark(dark);
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    }, []);

    const toggleTheme = useCallback(() => {
        setIsDark(prev => {
            const next = !prev;
            document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
            localStorage.setItem('eznr_theme', next ? 'dark' : 'light');
            return next;
        });
    }, []);

    const setTheme = useCallback((dark) => {
        setIsDark(dark);
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        localStorage.setItem('eznr_theme', dark ? 'dark' : 'light');
    }, []);

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
