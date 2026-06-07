import { SignJWT, jwtVerify } from 'jose'

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (
    isProduction &&
    (!secret || secret === 'dev-secret-change-in-production' || secret.startsWith('change_this'))
  ) {
    throw new Error('JWT_SECRET must be configured in production')
  }

  return new TextEncoder().encode(secret ?? 'dev-secret-change-in-production')
}

export interface JwtPayload {
  sub: string  // userId
  email: string
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret())
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return { sub: payload.sub as string, email: payload.email as string }
  } catch {
    return null
  }
}
