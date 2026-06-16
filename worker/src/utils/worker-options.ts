export const longRunningWorkerOptions = {
  lockDuration: 30 * 60 * 1000,
  stalledInterval: 60 * 1000,
  maxStalledCount: 1,
}

export const singleLongRunningWorkerOptions = {
  ...longRunningWorkerOptions,
  concurrency: 1,
}
