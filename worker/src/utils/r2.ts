import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'

let _client: S3Client | null = null

/** 返回 R2 客户端；缺少环境变量时返回 null（降级到本地存储） */
function getClient(): S3Client | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null

  if (!_client) {
    _client = new S3Client({
      region:   'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  }
  return _client
}

/**
 * 将本地视频文件上传到 Cloudflare R2。
 * @returns 上传成功返回公开访问 URL；未配置 R2 时返回 null（走本地存储降级）
 */
export async function uploadToR2(localPath: string, demoId: string): Promise<string | null> {
  const client = getClient()
  if (!client) return null

  const bucket    = process.env.R2_BUCKET_NAME
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '')
  if (!bucket || !publicUrl) {
    console.warn('[r2] R2_BUCKET_NAME 或 R2_PUBLIC_URL 未配置，回退本地存储')
    return null
  }

  const key        = `videos/${demoId}/final.mp4`
  const { size }   = await stat(localPath)

  await client.send(new PutObjectCommand({
    Bucket:        bucket,
    Key:           key,
    Body:          createReadStream(localPath),
    ContentType:   'video/mp4',
    ContentLength: size,
    CacheControl:  'public, max-age=31536000, immutable',
  }))

  const url = `${publicUrl}/${key}`
  console.log(`[r2] 上传成功 → ${url}`)
  return url
}
