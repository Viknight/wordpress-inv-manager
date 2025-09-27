// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

export async function POST(req: Request) {
  const { password } = await req.json();
  const token = randomBytes(32).toString('base64url');
  const ok = password && process.env.ADMIN_PASSWORD_HASH &&
    bcrypt.compareSync(password, process.env.ADMIN_PASSWORD_HASH);
  if (!ok) return NextResponse.json({ ok:false, error:'Invalid password' }, { status:401 });

  const isProd = process.env.NODE_ENV === 'production';
  const res = NextResponse.json({ ok:true });
  res.cookies.set('inv_auth', '1', {
    httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 60*60*8
  });
  res.cookies.set('csrf_token', token, { httpOnly: false, sameSite: 'lax', path: '/', secure: isProd });
  return res;
}
