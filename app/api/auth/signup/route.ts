import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const name = (formData.get('name') as string)?.trim()

  const redir = (path: string) =>
    NextResponse.redirect(new URL(path, request.url), { status: 303 })

  if (!email || !password || !name) return redir('/signup?error=Please+fill+in+all+fields')
  if (password !== confirmPassword) return redir('/signup?error=Passwords+do+not+match')
  if (password.length < 8) return redir('/signup?error=Password+must+be+at+least+8+characters')

  // Admin client — bypasses email confirmation
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { display_name: name },
  })

  if (createError) {
    const msg = createError.message.toLowerCase()
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return redir('/signup?error=An+account+with+this+email+already+exists')
    }
    return redir('/signup?error=' + encodeURIComponent(createError.message))
  }

  if (!created?.user) return redir('/signup?error=Account+creation+failed')

  // Collect ALL Supabase cookies (may be chunked for large JWTs)
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

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

  if (signInError) {
    return redir('/login?success=Account+created!+Please+sign+in.')
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url), { status: 303 })
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  })

  return response
}
