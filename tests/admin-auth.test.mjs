import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { safeEqual, isAdminKey } from '../lib/admin-auth.js'
import { middleware } from '../middleware.js'

describe('safeEqual / isAdminKey', () => {
  beforeEach(() => { process.env.ADMIN_SECRET_KEY = 'real-admin-key' })

  it('compares exactly', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('', '')).toBe(true)
  })

  it('accepts only the configured key', () => {
    expect(isAdminKey('real-admin-key')).toBe(true)
    expect(isAdminKey('handld-admin-2024')).toBe(false)
    expect(isAdminKey(null)).toBe(false)
    expect(isAdminKey('')).toBe(false)
  })

  it('fails closed when ADMIN_SECRET_KEY is unset', () => {
    delete process.env.ADMIN_SECRET_KEY
    expect(isAdminKey('handld-admin-2024')).toBe(false)
    expect(isAdminKey('')).toBe(false)
    expect(isAdminKey('undefined')).toBe(false)
  })
})

describe('middleware admin pages', () => {
  const visit = (url, host) => middleware(new NextRequest(url, { headers: { host } }))
  const blocked = res => res.status === 404

  beforeEach(() => { process.env.ADMIN_SECRET_KEY = 'real-admin-key' })

  for (const [label, url, host] of [
    ['schedule subdomain', 'https://schedule.handldhome.com/', 'schedule.handldhome.com'],
    ['preview /admin', 'https://x.vercel.app/admin', 'x.vercel.app'],
    ['localhost /admin', 'http://localhost:3000/admin', 'localhost:3000']
  ]) {
    it(`${label}: 404 without key, wrong key, or old fallback`, () => {
      expect(blocked(visit(url, host))).toBe(true)
      expect(blocked(visit(`${url}?key=nope`, host))).toBe(true)
      expect(blocked(visit(`${url}?key=handld-admin-2024`, host))).toBe(true)
    })

    it(`${label}: open with the right key`, () => {
      expect(blocked(visit(`${url}?key=real-admin-key`, host))).toBe(false)
    })

    it(`${label}: closed to everyone when ADMIN_SECRET_KEY is unset`, () => {
      delete process.env.ADMIN_SECRET_KEY
      expect(blocked(visit(`${url}?key=handld-admin-2024`, host))).toBe(true)
      expect(blocked(visit(`${url}?key=`, host))).toBe(true)
    })
  }

  it('tech onboarding stays public on the schedule subdomain', () => {
    expect(blocked(visit('https://schedule.handldhome.com/tech/onboarding', 'schedule.handldhome.com'))).toBe(false)
  })
})
