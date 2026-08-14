/** 백엔드 API 클라이언트.
 *  개발 중에는 Vite proxy(/api)를 통해 호출한다 —
 *  그래야 모바일 실기기에서 LAN IP로 접속해도 그대로 동작한다.
 */

const BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE ?? '')

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

type Options = Omit<RequestInit, 'body'> & { body?: unknown }

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const { body, headers, ...rest } = options

  const res = await fetch(`${BASE}/api${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await res.json() : null

  if (!res.ok) {
    const code = (data as { error?: string } | null)?.error ?? 'unknown_error'
    const message = (data as { message?: string } | null)?.message ?? '요청을 처리하지 못했습니다.'
    throw new ApiError(res.status, code, message)
  }

  return data as T
}
