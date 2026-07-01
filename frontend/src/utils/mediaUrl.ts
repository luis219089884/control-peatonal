const API_BASE = (
  import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:8000/graphql/'
).replace(/\/graphql\/?$/, '')

export function resolveMediaUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:')) return path
  if (path.startsWith('/media/')) return `${API_BASE}${path}`
  const rel = path.startsWith('/') ? path.slice(1) : path
  return `${API_BASE}/media/${rel}`
}
