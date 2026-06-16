'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

type PaddleEvent = {
  name?: string
  event?: string
  type?: string
}

type PaddleWindow = Window & {
  Paddle?: {
    Environment?: {
      set: (environment: 'sandbox') => void
    }
    Initialize: (options: {
      token: string
      eventCallback?: (event: PaddleEvent) => void
    }) => void
    Checkout: {
      open: (options: {
        transactionId: string
        settings: {
          successUrl: string
        }
      }) => void
    }
  }
}

const COPY = {
  zh: {
    opening: '正在打开 Paddle 安全支付...',
    confirming: '正在确认支付，稍后会自动返回 Showrunner。',
    missing: '缺少 Paddle 交易 ID，无法打开支付。',
    scriptFailed: 'Paddle 支付脚本加载失败，请返回后重试。',
    configMissing: 'Paddle client token 未配置，请联系支持。',
  },
  en: {
    opening: 'Opening secure Paddle checkout...',
    confirming: 'Payment is being confirmed. You will be returned to Showrunner automatically.',
    missing: 'Missing Paddle transaction ID. Checkout cannot be opened.',
    scriptFailed: 'Paddle checkout script failed to load. Please go back and try again.',
    configMissing: 'Paddle client token is not configured. Please contact support.',
  },
}

function eventName(event: PaddleEvent): string {
  return String(event.name || event.event || event.type || '').toLowerCase()
}

export function PaddleCheckoutClient({
  transactionId,
  clientToken,
  environment,
  successUrl,
  processingUrl,
  locale,
}: {
  transactionId: string
  clientToken: string
  environment: 'sandbox' | 'production'
  successUrl: string
  processingUrl: string
  locale: 'zh' | 'en'
}) {
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState(COPY[locale].opening)
  const openedRef = useRef(false)

  useEffect(() => {
    if (!transactionId) {
      setMessage(COPY[locale].missing)
      return
    }
    if (!clientToken) {
      setMessage(COPY[locale].configMissing)
      return
    }
    if (!ready || openedRef.current) return

    const paddleWindow = window as PaddleWindow
    if (!paddleWindow.Paddle) {
      setMessage(COPY[locale].scriptFailed)
      return
    }

    openedRef.current = true

    let fallbackTimer: number | null = window.setTimeout(() => {
      window.location.replace(processingUrl)
    }, 90000)

    function returnTo(url: string) {
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer)
        fallbackTimer = null
      }
      window.location.replace(url)
    }

    try {
      if (environment === 'sandbox') {
        paddleWindow.Paddle.Environment?.set('sandbox')
      }

      paddleWindow.Paddle.Initialize({
        token: clientToken,
        eventCallback: (event) => {
          const name = eventName(event)
          if (name === 'checkout.completed' || name === 'checkout.payment.completed' || name === 'transaction.completed') {
            returnTo(successUrl)
            return
          }
          if (name === 'checkout.payment.initiated' || name === 'checkout.payment.selected' || name === 'checkout.payment.created') {
            setMessage(COPY[locale].confirming)
            return
          }
          if (name === 'checkout.closed' || name === 'checkout.close') {
            returnTo(processingUrl)
          }
        },
      })

      paddleWindow.Paddle.Checkout.open({
        transactionId,
        settings: {
          successUrl,
        },
      })
    } catch {
      openedRef.current = false
      setMessage(COPY[locale].scriptFailed)
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer)
        fallbackTimer = null
      }
    }

    return () => {
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer)
      }
    }
  }, [clientToken, environment, locale, processingUrl, ready, successUrl, transactionId])

  return (
    <>
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() => setMessage(COPY[locale].scriptFailed)}
      />
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {message}
      </p>
    </>
  )
}
