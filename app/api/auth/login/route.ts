import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  const loginError = (msg: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, request.url), { status: 303 })

  if (!email || !password) return loginError('Please fill in all fields')

  // We need to collect ALL cookies Supabase wants to set (may be chunked)
  const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(items) {
          items.forEach(({ name, value, options }) => {
            cookiesToSet.push({ name, value, options })
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error('[login] Supabase error:', error.message)
    return loginError('Invalid email or password')
  }

  // Build success redirect and apply ALL cookies Supabase collected
  const response = NextResponse.redirect(new URL('/dashboard', request.url), { status: 303 })
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  })

  return response
}
