import { NextRequest, NextResponse } from 'next/server'

export const config = {
  matcher: ['/', '/index', '/labs', '/launch', '/news', '/personas' ],
}

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization')
  const url = req.nextUrl

  const envUsername = process.env.BASIC_AUTH_USERNAME
  const envPassword = process.env.BASIC_AUTH_PASSWORD

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1]
    const [user, pwd] = atob(authValue).split(':')

    if (user === envUsername && pwd === envPassword) {
      return NextResponse.next()
    }
  }

  // If the user is not authenticated, redirect to the auth page
  url.pathname = '/api/auth/auth'

  return NextResponse.rewrite(url)
}