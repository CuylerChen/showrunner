'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DemoStatus } from '@/types'

export function useDemoRealtime(demoId: string, initialStatus: DemoStatus) {
  const [status, setStatus] = useState<DemoStatus>(initialStatus)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`demo-${demoId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'demos', filter: `id=eq.${demoId}` },
        (payload) => {
          setStatus(payload.new.status as DemoStatus)
          setErrorMessage(payload.new.error_message ?? null)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [demoId])

  return { status, errorMessage }
}
