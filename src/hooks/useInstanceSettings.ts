'use client'

import { useState, useEffect } from 'react'

interface InstanceSettings {
  emailEnabled: boolean
  signupsEnabled: boolean
}

const DEFAULT_SETTINGS: InstanceSettings = {
  emailEnabled: true,
  signupsEnabled: true,
}

// Module-level cache so every component shares one fetch
let cachedSettings: InstanceSettings | null = null
let fetchPromise: Promise<InstanceSettings> | null = null

function fetchSettings(): Promise<InstanceSettings> {
  if (cachedSettings) return Promise.resolve(cachedSettings)
  if (fetchPromise) return fetchPromise

  fetchPromise = fetch('/api/instance-settings')
    .then((res) => {
      if (!res.ok) throw new Error('Failed to fetch instance settings')
      return res.json()
    })
    .then((data: InstanceSettings) => {
      cachedSettings = data
      return data
    })
    .catch(() => {
      // On error, fall back to defaults and allow retry
      fetchPromise = null
      return DEFAULT_SETTINGS
    })

  return fetchPromise
}

export function useInstanceSettings(): InstanceSettings & { isLoading: boolean } {
  const [settings, setSettings] = useState<InstanceSettings>(cachedSettings ?? DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(!cachedSettings)

  useEffect(() => {
    if (cachedSettings) {
      setSettings(cachedSettings)
      setIsLoading(false)
      return
    }

    fetchSettings().then((data) => {
      setSettings(data)
      setIsLoading(false)
    })
  }, [])

  return { ...settings, isLoading }
}
