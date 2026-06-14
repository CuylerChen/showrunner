type SubscriptionPeriodInput = {
  current_period_end: Date | string | null
  demos_used_this_month: number
}

export type SubscriptionPeriodUpdate = {
  current_period_end: Date
  demos_used_this_month?: number
}

function toValidDate(value: Date | string | null): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function addMonthlyPeriod(date: Date): Date {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const targetMonthDays = new Date(Date.UTC(
    year,
    month + 2,
    0,
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  )).getUTCDate()

  return new Date(Date.UTC(
    year,
    month + 1,
    Math.min(day, targetMonthDays),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  ))
}

export function computeSubscriptionPeriodUpdate(
  subscription: SubscriptionPeriodInput,
  now = new Date(),
): SubscriptionPeriodUpdate | null {
  const periodEnd = toValidDate(subscription.current_period_end)
  if (!periodEnd) {
    return { current_period_end: addMonthlyPeriod(now) }
  }

  if (periodEnd.getTime() > now.getTime()) return null

  let nextPeriodEnd = periodEnd
  while (nextPeriodEnd.getTime() <= now.getTime()) {
    nextPeriodEnd = addMonthlyPeriod(nextPeriodEnd)
  }

  return {
    current_period_end: nextPeriodEnd,
    demos_used_this_month: 0,
  }
}
