/** 입력 유효성 규칙.
 *  DB의 CHECK 제약 및 Supabase Auth 설정과 반드시 일치시킬 것.
 *    - login_id : supabase/migrations/*_init.sql 의 check
 *    - password : supabase/config.toml 의 minimum_password_length / password_requirements
 */

export const LOGIN_ID_RE = /^[a-z0-9_]{4,20}$/
export const PHONE_RE = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const PASSWORD_MIN = 8

/** 값이 유효하면 null, 아니면 사용자에게 보여줄 메시지를 반환. */
export type Validator = (value: string) => string | null

export const validateLoginId: Validator = (v) => {
  const value = v.trim()
  if (!value) return 'ID를 입력해 주세요.'
  if (value.length < 4) return 'ID는 4자 이상이어야 합니다.'
  if (value.length > 20) return 'ID는 20자 이하여야 합니다.'
  if (!LOGIN_ID_RE.test(value)) return '영문 소문자, 숫자, 밑줄(_)만 사용할 수 있습니다.'
  return null
}

export const validatePassword: Validator = (v) => {
  if (!v) return '비밀번호를 입력해 주세요.'
  if (v.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`
  if (!/[a-zA-Z]/.test(v) || !/[0-9]/.test(v)) return '영문과 숫자를 모두 포함해야 합니다.'
  return null
}

export const validateName: Validator = (v) => {
  const value = v.trim()
  if (!value) return '성명을 입력해 주세요.'
  if (value.length > 50) return '50자 이하로 입력해 주세요.'
  return null
}

export const validateDepartment: Validator = (v) => {
  const value = v.trim()
  if (!value) return '부서를 입력해 주세요.'
  if (value.length > 50) return '50자 이하로 입력해 주세요.'
  return null
}

export const validatePhone: Validator = (v) => {
  const value = v.trim()
  if (!value) return '전화번호를 입력해 주세요.'
  if (!PHONE_RE.test(value)) return '010-1234-5678 형식으로 입력해 주세요.'
  return null
}

/** 사내 도메인 검증은 설정(app_settings)에 따라 켜지므로 인자로 받는다. */
export function validateEmail(v: string, allowedDomains: string[] = []): string | null {
  const value = v.trim().toLowerCase()
  if (!value) return '이메일을 입력해 주세요.'
  if (!EMAIL_RE.test(value)) return '올바른 이메일 형식이 아닙니다.'
  if (allowedDomains.length > 0) {
    const domain = value.split('@')[1]
    if (!allowedDomains.includes(domain)) {
      return `사내 이메일만 사용할 수 있습니다 (${allowedDomains.join(', ')})`
    }
  }
  return null
}

/** 차량번호.
 *  형식이 시기·용도마다 달라(12가3456 / 서울12가3456 / 임시번호판)
 *  숫자와 한글이 하나씩은 있는지만 본다. DB 의 check 제약과 같은 규칙이다.
 */
export const validateVehicleNo: Validator = (v) => {
  const value = v.trim().replace(/\s+/g, ' ')
  if (!value) return '차량번호를 입력해 주세요.'
  if (value.length < 5 || value.length > 20) return '차량번호를 정확히 입력해 주세요.'
  if (!/[0-9]/.test(value) || !/[가-힣]/.test(value))
    return '숫자와 한글이 포함된 차량번호를 입력해 주세요. (예: 12가3456)'
  return null
}

/** 입력 중 자동으로 하이픈을 넣는다. 010-1234-5678 */
export function formatPhone(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 11)
  if (d.length < 4) return d
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}
