'use client'

import { useState, useEffect } from 'react'

/**
 * Toast notification component.
 * Shows a small notification at the bottom-right that auto-dismisses.
 * @param {{ message: string, type: 'success' | 'error', onDismiss: () => void }} props
 */
export default function Toast({ message, type = 'success', onDismiss }) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setIsVisible(false), 2700)
    const removeTimer = setTimeout(() => onDismiss(), 3000)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [onDismiss])

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      padding: '12px 20px',
      borderRadius: '8px',
      backgroundColor: type === 'success' ? '#059669' : '#DC2626',
      color: 'white',
      fontSize: '14px',
      fontWeight: '600',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      opacity: isVisible ? 1 : 0,
      transition: 'opacity 0.3s ease-out',
      pointerEvents: isVisible ? 'auto' : 'none'
    }}>
      <span>{type === 'success' ? '✓' : '✕'}</span>
      <span>{message}</span>
    </div>
  )
}
