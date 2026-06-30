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

type MessageKey = 'opening' | 'confirming' | 'scriptFailed'

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
  const [messageKey, setMessageKey] = useState<MessageKey>('opening')
  const openedRef = useRef(false)
  const fallbackTimerRef = useRef<number | null>(null)

  const configMessage = !transactionId
    ? COPY[locale].missing
    : !clientToken
      ? COPY[locale].configMissing
      : null

  const message = configMessage ?? COPY[locale][messageKey]

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) {
        window.clearTimeout(fallbackTimerRef.current)
      }
    }
  }, [])

  function clearFallbackTimer() {
    if (fallbackTimerRef.current) {
      window.clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
  }

  function returnTo(url: string) {
    clearFallbackTimer()
    window.location.replace(url)
  }

  function openCheckout() {
    if (configMessage || openedRef.current) return

    const paddleWindow = window as PaddleWindow
    if (!paddleWindow.Paddle) {
      setMessageKey('scriptFailed')
      return
    }

    openedRef.current = true

    fallbackTimerRef.current = window.setTimeout(() => {
      window.location.replace(processingUrl)
    }, 90000)

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
            setMessageKey('confirming')
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
      setMessageKey('scriptFailed')
      clearFallbackTimer()
    }
  }

  return (
    <>
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onReady={openCheckout}
        onError={() => setMessageKey('scriptFailed')}
      />
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {message}
      </p>
    </>
  )
}
