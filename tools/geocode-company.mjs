/** 주소를 카카오 API로 정확한 좌표로 변환해 출력.
 *
 *   npm run geocode                          # .env 의 기본 주소 사용
 *   npm run geocode -- "울산 남구 신두왕로 50"
 *
 * 출력된 값을 app_settings.company_lat / company_lng 에 반영한다.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DEFAULT_QUERY = '울산광역시 남구 신두왕로 50'

function readEnv(key) {
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
      if (m && m[1] === key) return m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* .env 없음 */
  }
  return process.env[key] ?? ''
}

const key = readEnv('KAKAO_REST_KEY')
if (!key) {
  console.error('KAKAO_REST_KEY 가 .env 에 없습니다.')
  process.exit(1)
}

const query = process.argv.slice(2).join(' ').trim() || DEFAULT_QUERY
const headers = { Authorization: `KakaoAK ${key}` }

async function search(endpoint, params) {
  const url = new URL(`https://dapi.kakao.com/v2/local/search/${endpoint}.json`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, { headers })
  if (!res.ok) {
    console.error(`카카오 API 오류 ${res.status}: ${await res.text()}`)
    process.exit(1)
  }
  return (await res.json()).documents ?? []
}

// 1) 주소 검색 → 2) 실패 시 장소(키워드) 검색으로 폴백
let docs = await search('address', { query })
if (docs.length === 0) docs = await search('keyword', { query })

if (docs.length === 0) {
  console.error(`'${query}' 검색 결과가 없습니다.`)
  process.exit(1)
}

console.log(`\n검색어: ${query}\n`)
docs.slice(0, 5).forEach((d, i) => {
  const name = d.place_name ?? d.address_name ?? ''
  const road = d.road_address_name ?? d.road_address?.address_name ?? ''
  console.log(`  [${i + 1}] ${name}${road ? ` / ${road}` : ''}`)
  console.log(`       lat=${d.y}  lng=${d.x}`)
})

const top = docs[0]
console.log(`
── app_settings 에 반영할 SQL ──────────────────
update public.app_settings
   set company_lat = ${top.y},
       company_lng = ${top.x},
       updated_at  = now()
 where id = 1;
`)
