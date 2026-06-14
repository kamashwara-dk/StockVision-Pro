import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

// Uses the service-role key to create users with email_confirm: true
// so no verification email is required. Then immediately signs them in.
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const name = (formData.get('name') as string)?.trim()

  const redirect = (path: string) =>
    NextResponse.redirect(new URL(path, request.url), { status: 303 })

  if (!email || !password || !name) return redirect('/signup?error=Please+fill+in+all+fields')
  if (password !== confirmPassword) return redirect('/signup?error=Passwords+do+not+match')
  if (password.length < 8) return redirect('/signup?error=Password+must+be+at+least+8+characters')

  // Admin client bypasses email confirmation
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // auto-confirmed — no email needed
    user_metadata: { display_name: name },
  })

  if (createError) {
    const msg = createError.message.toLowerCase()
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return redirect('/signup?error=An+account+with+this+email+already+exists')
    }
    return redirect('/signup?error=' + encodeURIComponent(createError.message))
  }

  if (!created?.user) return redirect('/signup?error=Account+creation+failed')

  // Auto sign-in after creation — attach cookies to the redirect response
  const successResponse = NextResponse.redirect(new URL('/dashboard', request.url), {
    status: 303,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            successResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

  if (signInError) {
    // Account created but auto-sign-in failed — send to login page
    return redirect('/login?success=Account+created!+Please+sign+in.')
  }

  return successResponse
}
