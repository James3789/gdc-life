/**
 * 카카오모빌리티 길찾기 프록시 (Deno / Supabase Edge Function)
 *
 * REST 키는 브라우저에 노출할 수 없고 카카오 API 는 CORS 도 열려 있지 않으므로
 * 반드시 서버를 거쳐야 한다. 이 함수가 그 유일한 서버 조각이다.
 *
 * 배포:
 *   npx supabase secrets set KAKAO_REST_KEY=...
 *   npx supabase functions deploy kakao-directions
 *
 * 호출 (로그인 필요):
 *   supabase.functions.invoke('kakao-directions', { body: { origin, destination, waypoints } })
 *
 * 인증을 두 겹으로 둔다:
 *   1) config.toml 의 verify_jwt — 서명이 유효한 토큰인지
 *   2) 아래 getUser() — 그 토큰이 '로그인한 사용자'의 것인지
 * anon 키도 서명이 유효한 JWT 라서 1)만으로는 통과한다. anon 키는 프론트 번들에
 * 그대로 실려 나가므로, 2)가 없으면 누구나 카카오 쿼터를 소진시킬 수 있다.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

type Point = { lat: number; lng: number }

const KAKAO_URL = 'https://apis-navi.kakaomobility.com/v1/waypoints/directions'
const MAX_WAYPOINTS = 30

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function isPoint(v: unknown): v is Point {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return (
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lng >= -180 &&
    p.lng <= 180
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // ── 로그인한 사용자인지 확인 (anon 키 호출 차단) ──
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  )
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth?.user) return json({ error: 'unauthorized' }, 401)

  const key = Deno.env.get('KAKAO_REST_KEY')
  if (!key) return json({ error: 'kakao_key_missing' }, 500)

  let body: { origin?: unknown; destination?: unknown; waypoints?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const { origin, destination } = body
  const waypoints = Array.isArray(body.waypoints) ? body.waypoints : []

  if (!isPoint(origin) || !isPoint(destination)) {
    return json({ error: 'invalid_coordinates' }, 400)
  }
  if (waypoints.length > MAX_WAYPOINTS || !waypoints.every(isPoint)) {
    return json({ error: 'invalid_waypoints', max: MAX_WAYPOINTS }, 400)
  }

  const res = await fetch(KAKAO_URL, {
    method: 'POST',
    headers: {
      Authorization: `KakaoAK ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      origin: { x: origin.lng, y: origin.lat },
      destination: { x: destination.lng, y: destination.lat },
      waypoints: waypoints.map((w, i) => ({ name: `경유지${i + 1}`, x: w.lng, y: w.lat })),
      priority: 'RECOMMEND',
      alternatives: false,
      road_details: false,
    }),
  })

  if (!res.ok) {
    // 카카오 응답 본문은 키가 섞여 나올 수 있으므로 그대로 흘리지 않는다
    console.error('kakao error', res.status, await res.text())
    return json({ error: 'kakao_request_failed', status: res.status }, 502)
  }

  const data = await res.json()
  const route = data?.routes?.[0]

  // result_code 0 이 성공. 그 외는 경로 없음/좌표 오류 등
  if (!route || route.result_code !== 0) {
    return json(
      { error: 'route_not_found', code: route?.result_code, message: route?.result_msg },
      422,
    )
  }

  // sections[].roads[].vertexes 는 [x, y, x, y, ...] 평면 배열
  const path: Point[] = []
  for (const section of route.sections ?? []) {
    for (const road of section.roads ?? []) {
      const v: number[] = road.vertexes ?? []
      for (let i = 0; i + 1 < v.length; i += 2) {
        path.push({ lng: v[i], lat: v[i + 1] })
      }
    }
  }

  return json({
    distanceM: route.summary?.distance ?? null,
    durationS: route.summary?.duration ?? null,
    path,
  })
})
