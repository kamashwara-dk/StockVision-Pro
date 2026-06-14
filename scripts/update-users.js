const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase credentials in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function updateUsers() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  
  if (error) {
    console.error('Error fetching users:', error)
    return
  }

  console.log(`Found ${users.length} users.`)

  for (const user of users) {
    if (user.email === 'admin@stockvision.pro') {
      console.log(`Updating admin user ${user.id}...`)
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: { display_name: 'ADMIN' }
      })
    } else {
      console.log(`Deleting example user ${user.email} (${user.id})...`)
      await supabase.auth.admin.deleteUser(user.id)
    }
  }
  console.log('User cleanup complete.')
}

updateUsers()
