'use client'

import { useEffect, useState } from 'react'
import type { DemoStatus } from '@/types'

export function useDemoRealtime(demoId: string, initialStatus: DemoStatus) {
  const [status, setStatus] = useState<DemoStatus>(initialStatus)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    // 终态无需监听
    if (initialStatus === 'completed' || initialStatus === 'failed') return

    const es = new EventSource(`/api/demos/${demoId}/status`)

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { status: DemoStatus; error_message: string | null }
        setStatus(data.status)
        setErrorMessage(data.error_message ?? null)

        if (data.status === 'completed' || data.status === 'failed') {
          es.close()
        }
      } catch {
        // 忽略解析错误
      }
    }

    es.onerror = () => {
      es.close()
    }

    return () => { es.close() }
  }, [demoId, initialStatus])

  return { status, errorMessage }
}
