import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Route Handler for login — ensures Set-Cookie headers are flushed
// before the redirect response is returned (Server Actions + redirect()
// can race with cookie writes in Next.js 16).
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!email || !password) {
    return NextResponse.redirect(
      new URL('/login?error=Please+fill+in+all+fields', request.url)
    )
  }

  // Build the response first so we can attach cookies to it
  const response = NextResponse.redirect(new URL('/dashboard', request.url), {
    status: 303, // POST→redirect
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.redirect(
      new URL('/login?error=Invalid+email+or+password', request.url),
      { status: 303 }
    )
  }

  return response
}
