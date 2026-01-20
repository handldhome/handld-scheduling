import { NextResponse } from 'next/server'

// Secret key for admin dashboard access - set in Vercel environment variables
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'handld-admin-2024'

export function middleware(request) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''

  // Extract subdomain (e.g., "availability" from "availability.handldhome.com")
  const subdomain = hostname.split('.')[0]

  // Skip for localhost development and Vercel preview URLs
  const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1')
  const isVercelPreview = hostname.includes('vercel.app')

  if (isLocalhost || isVercelPreview) {
    // For admin routes, still check the secret key
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      const key = url.searchParams.get('key')
      if (key !== ADMIN_SECRET_KEY) {
        return new NextResponse('Not Found', { status: 404 })
      }
    }
    return NextResponse.next()
  }

  // Handle subdomain routing
  switch (subdomain) {
    case 'availability':
      // availability.handldhome.com -> /tech/[techId]/availability
      // If path is just /, show a helpful message or redirect
      if (url.pathname === '/') {
        return new NextResponse('Tech ID required. Use: availability.handldhome.com/tech/[techId]/availability', { status: 400 })
      }
      // Allow /tech/[techId]/availability paths through
      if (url.pathname.startsWith('/tech/') && url.pathname.includes('/availability')) {
        return NextResponse.next()
      }
      // Rewrite other paths to include /tech prefix if it looks like a tech ID
      if (url.pathname.match(/^\/rec[A-Za-z0-9]+$/)) {
        url.pathname = `/tech${url.pathname}/availability`
        return NextResponse.rewrite(url)
      }
      break

    case 'work':
      // work.handldhome.com -> /tech/[techId]/schedule
      if (url.pathname === '/') {
        return new NextResponse('Tech ID required. Use: work.handldhome.com/tech/[techId]/schedule', { status: 400 })
      }
      // Allow /tech/[techId]/schedule paths through
      if (url.pathname.startsWith('/tech/') && url.pathname.includes('/schedule')) {
        return NextResponse.next()
      }
      // Rewrite other paths to include /tech prefix if it looks like a tech ID
      if (url.pathname.match(/^\/rec[A-Za-z0-9]+$/)) {
        url.pathname = `/tech${url.pathname}/schedule`
        return NextResponse.rewrite(url)
      }
      break

    case 'schedule':
      // schedule.handldhome.com -> /admin (with secret key protection)
      // Allow API routes through WITHOUT key check (called from authenticated dashboard)
      if (url.pathname.startsWith('/api')) {
        return NextResponse.next()
      }
      // Check secret key for page access
      const key = url.searchParams.get('key')
      if (key !== ADMIN_SECRET_KEY) {
        return new NextResponse('Not Found', { status: 404 })
      }
      // Rewrite root to /admin
      if (url.pathname === '/') {
        url.pathname = '/admin'
        return NextResponse.rewrite(url)
      }
      // Allow /admin paths through
      if (url.pathname.startsWith('/admin')) {
        return NextResponse.next()
      }
      break

    default:
      // For main domain or unknown subdomains, require key for admin
      if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
        const key = url.searchParams.get('key')
        if (key !== ADMIN_SECRET_KEY) {
          return new NextResponse('Not Found', { status: 404 })
        }
      }
      break
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except static files and _next
    '/((?!_next/static|_next/image|favicon.ico|logo-dark.png|.*\\.png$).*)',
  ],
}
