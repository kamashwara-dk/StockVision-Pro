const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase credentials in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdmin() {
  const email = 'admin@stockvision.pro'
  const password = 'AdminSecure123!'

  console.log(`Attempting to create admin user: ${email}`)

  // Create the user via the admin API
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true // Automatically confirm the email
  })

  if (error) {
    if (error.message.includes('already exists') || error.message.includes('already registered')) {
      console.log('✅ Admin user already exists.')
    } else {
      console.error('❌ Error creating admin user:', error.message)
    }
  } else {
    console.log('✅ Admin user created successfully!', data.user.id)
  }
}

createAdmin()
