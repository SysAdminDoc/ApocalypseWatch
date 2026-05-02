import { useEffect, useRef, useState } from 'react'
import { DASHBOARD_POLL_INTERVAL_MS, DASHBOARD_URL } from '../lib/constants'

const REQUEST_TIMEOUT_MS = 15_000
const BASE_RETRY_DELAY_MS = 15_000
const MAX_RETRY_DELAY_MS = 5 * 60_000
const MAX_BACKOFF_EXPONENT = 5

function getDashboardUrl() {
  return `${DASHBOARD_URL}${DASHBOARD_URL.includes('?') ? '&' : '?'}t=${Date.now()}`
}

function getRetryDelayMs(failureCount) {
  const exponent = Math.min(Math.max(0, failureCount - 1), MAX_BACKOFF_EXPONENT)
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** exponent, MAX_RETRY_DELAY_MS)
}

export function useDashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [lastFetchedAt, setLastFetchedAt] = useState(null)
  const [retryInMs, setRetryInMs] = useState(null)
  const [isFetching, setIsFetching] = useState(false)
  const abortRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    let active = true
    let failureCount = 0

    function schedule(delayMs) {
      if (!active) return
      timerRef.current = window.setTimeout(load, delayMs)
    }

    async function load() {
      abortRef.current?.abort()
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      abortRef.current = controller
      setIsFetching(true)

      try {
        const response = await fetch(getDashboardUrl(), {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`Dashboard request failed: ${response.status}`)
        const json = await response.json()
        if (!active) return
        failureCount = 0
        setData(json)
        setError(null)
        setRetryInMs(null)
        setLastFetchedAt(new Date())
        schedule(DASHBOARD_POLL_INTERVAL_MS)
      } catch (err) {
        if (!active) return
        failureCount += 1
        const retryDelay = getRetryDelayMs(failureCount)
        setError(err?.name === 'AbortError' ? 'Dashboard request timed out.' : err?.message ?? 'Dashboard request failed.')
        setRetryInMs(retryDelay)
        schedule(retryDelay)
      } finally {
        window.clearTimeout(timeoutId)
        if (abortRef.current === controller) abortRef.current = null
        if (active) setIsFetching(false)
      }
    }

    load()
    return () => {
      active = false
      window.clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [])

  return { data, error, lastFetchedAt, retryInMs, isFetching }
}
