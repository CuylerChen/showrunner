import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt } from './lib/jwt'

const PUBLIC_PATHS = [
  '/',
  '/sign-in',
  '/sign-up',
]

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  if (pathname.startsWith('/share/')) return true
  if (pathname.startsWith('/api/share/')) return true
  if (pathname.startsWith('/api/auth/')) return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('token')?.value

  if (isPublic(pathname)) {
    // 公开页面：有 token 时仍注入用户信息，供首页判断登录状态
    if (token) {
      const payload = await verifyJwt(token)
      if (payload) {
        const requestHeaders = new Headers(request.headers)
        requestHeaders.set('x-user-id', payload.sub)
        requestHeaders.set('x-user-email', payload.email)
        return NextResponse.next({ request: { headers: requestHeaders } })
      }
    }
    return NextResponse.next()
  }

  if (!token) {
    const loginUrl = new URL('/sign-in', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const payload = await verifyJwt(token)
  if (!payload) {
    const loginUrl = new URL('/sign-in', request.url)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('token')
    return response
  }

  // 将用户信息注入 header，供 API 路由使用
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', payload.sub)
  requestHeaders.set('x-user-email', payload.email)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)','/(api|trpc)(.*)'],
}
