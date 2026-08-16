import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.VITE_SUPABASE_URL || 'https://qwhcfmmyeyvwxvcmjgkh.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('✗ SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.')
  process.exit(1)
}

const PASSWORD = 'gdclife1234'
const ACCOUNTS = [
  { loginId: 'admin', name: '관리자', department: '운영', phone: '010-9999-9999' },
  { loginId: 'driver1', name: '김봉사', department: '스마트십솔루션팀', phone: '010-1111-1111' },
  { loginId: 'driver2', name: '박운전', department: '디지털솔루션팀', phone: '010-2222-2222' },
  { loginId: 'rider1', name: '이탑승', department: '기술연구소', phone: '010-3333-3333' },
  { loginId: 'rider2', name: '최동승', department: '경영지원팀', phone: '010-4444-4444' },
]

const adminSupabase = createClient(URL_, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function run() {
  console.log('▶ 클라우드 계정 생성 및 권한 등록 시작...')

  for (const acc of ACCOUNTS) {
    const email = `${acc.loginId}@gdc-life.local`
    
    // 이미 존재하는지 확인
    const { data: usersData } = await adminSupabase.auth.admin.listUsers()
    const existing = usersData?.users?.find(u => u.email === email)

    let userId = existing?.id

    if (!userId) {
      const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
        email: email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: {
          login_id: acc.loginId,
          name: acc.name,
          department: acc.department,
          email: `${acc.loginId}@example.com`,
          phone: acc.phone,
        },
      })

      if (createError) {
        console.error(`✗ ${acc.loginId} 계정 생성 실패:`, createError.message)
        continue
      }
      userId = newUser.user.id
      console.log(`✓ ${acc.loginId} 계정 생성 완료 (UUID: ${userId})`)
    } else {
      console.log(`· ${acc.loginId} 계정이 이미 존재합니다. 비밀번호를 업데이트합니다.`)
      await adminSupabase.auth.admin.updateUserById(userId, {
        password: PASSWORD,
        email_confirm: true,
      })
    }

    // admin 인 경우 admin_users 에 등록
    if (acc.loginId === 'admin' && userId) {
      const { error: adminErr } = await adminSupabase
        .from('admin_users')
        .upsert({ user_id: userId, note: '운영 담당자 (시드)' }, { onConflict: 'user_id' })
      
      if (adminErr) {
        console.error('✗ admin_users 권한 등록 실패:', adminErr.message)
      } else {
        console.log('✓ admin 계정에 관리자 권한(admin_users) 등록 완료!')
      }
    }
  }

  console.log('\n모든 계정 생성이 정상 완료되었습니다!')
}

run().catch(console.error)
