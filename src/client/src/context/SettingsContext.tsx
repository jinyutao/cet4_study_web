import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { UserSettings } from '../types/models'
import type { MeResponse } from '../types/api'

export interface SettingsContextValue {
  settings: UserSettings
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>
  isLoading: boolean
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

const DEFAULTS: UserSettings = {
  newWordsPerSession: 15,
  dailyGoal: 40,
  spellingMode: false,
  firstLetterHint: true,
  choiceOptions: 4,
  previewBeforeLearn: true,
  dailyReminder: true,
  reminderTime: '20:00',
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<MeResponse>('/auth/me')
      .then((data) => {
        if (data.settings) {
          setSettings(data.settings)
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const updateSettings = useCallback(async (partial: Partial<UserSettings>) => {
    setIsLoading(true)
    try {
      const updated = await api.put<UserSettings>('/settings', partial)
      setSettings(updated)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  )
}
