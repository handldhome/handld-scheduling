import { describe, it, expect } from 'vitest'
import { parseW9Note, setW9InNotes } from '../lib/w9.mjs'

describe('W9 notes helpers', () => {
  it('parses private pathnames and legacy public URLs', () => {
    expect(parseW9Note('W9: w9/abc/1.pdf')).toEqual({ pathname: 'w9/abc/1.pdf' })
    expect(parseW9Note('W9: https://x.public.blob.vercel-storage.com/w9/a.pdf')).toEqual({
      legacyPublicUrl: 'https://x.public.blob.vercel-storage.com/w9/a.pdf'
    })
    expect(parseW9Note('other text\nW9: w9/abc/1.pdf')).toEqual({ pathname: 'w9/abc/1.pdf' })
    expect(parseW9Note(null)).toBeNull()
    expect(parseW9Note('no w9 here')).toBeNull()
    expect(parseW9Note('W9: w9/../secrets')).toBeNull()
  })

  it('replaces only the W9 line and keeps other notes', () => {
    expect(setW9InNotes(null, 'w9/a.pdf')).toBe('W9: w9/a.pdf')
    expect(setW9InNotes('Has a truck', 'w9/a.pdf')).toBe('Has a truck\nW9: w9/a.pdf')
    expect(setW9InNotes('Has a truck\nW9: https://x/y.pdf\nSpanish', 'w9/a.pdf')).toBe(
      'Has a truck\nW9: w9/a.pdf\nSpanish'
    )
  })
})
