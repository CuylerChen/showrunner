import assert from 'node:assert/strict'
import {
  addMonthlyPeriod,
  computeSubscriptionPeriodUpdate,
} from '../src/lib/subscription-period'

const now = new Date('2026-06-15T08:00:00.000Z')

assert.equal(
  addMonthlyPeriod(new Date('2026-01-31T10:00:00.000Z')).toISOString(),
  '2026-02-28T10:00:00.000Z',
)

assert.deepEqual(
  computeSubscriptionPeriodUpdate({
    current_period_end: null,
    demos_used_this_month: 1,
  }, now),
  { current_period_end: new Date('2026-07-15T08:00:00.000Z') },
)

assert.deepEqual(
  computeSubscriptionPeriodUpdate({
    current_period_end: new Date('2026-06-20T08:00:00.000Z'),
    demos_used_this_month: 8,
  }, now),
  null,
)

assert.deepEqual(
  computeSubscriptionPeriodUpdate({
    current_period_end: new Date('2026-05-15T08:00:00.000Z'),
    demos_used_this_month: 10,
  }, now),
  {
    current_period_end: new Date('2026-07-15T08:00:00.000Z'),
    demos_used_this_month: 0,
  },
)

console.log('subscription period tests passed')
