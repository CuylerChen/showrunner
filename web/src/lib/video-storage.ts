import path from 'path'

export function getVideoStorageDir() {
  const configured = process.env.VIDEO_DIR?.trim()
  if (configured) return configured
  if (process.env.NODE_ENV === 'production') return '/data/videos'
  return path.resolve(process.cwd(), '..', '.local', 'videos')
}
