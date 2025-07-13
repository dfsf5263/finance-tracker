'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface Household {
  id: string
  name: string
  annualBudget?: number | null
  userRole?: string
  _count?: {
    accounts: number
    users: number
    categories: number
    types: number
    transactions: number
  }
}

interface HouseholdContextType {
  households: Household[]
  selectedHousehold: Household | null
  isLoading: boolean
  requiresHouseholdCreation: boolean
  selectHousehold: (household: Household) => void
  refreshHouseholds: () => Promise<void>
  triggerHouseholdCreation: () => void
  completeHouseholdCreation: () => void
  getUserRole: (householdId?: string) => string | undefined
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined)

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [households, setHouseholds] = useState<Household[]>([])
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [requiresHouseholdCreation, setRequiresHouseholdCreation] = useState(false)

  const fetchHouseholds = async (retryCount = 0) => {
    try {
      const response = await fetch('/api/households')
      if (response.ok) {
        const data = await response.json()
        const previousHouseholds = households
        setHouseholds(data)

        // Handle household selection logic
        if (data.length === 0) {
          // No households exist - force creation
          setSelectedHousehold(null)
          setRequiresHouseholdCreation(true)
        } else {
          // Check if currently selected household still exists
          const currentStillExists =
            selectedHousehold && data.find((h: Household) => h.id === selectedHousehold.id)

          if (currentStillExists) {
            // Update selected household with fresh data
            setSelectedHousehold(currentStillExists)
            setRequiresHouseholdCreation(false)
          } else if (selectedHousehold && previousHouseholds.length > 0) {
            // Previously selected household was deleted - smart selection
            const deletedIndex = previousHouseholds.findIndex((h) => h.id === selectedHousehold.id)
            let newSelection: Household

            if (deletedIndex >= 0) {
              // Try household at same index
              if (data[deletedIndex]) {
                newSelection = data[deletedIndex]
              }
              // Try previous household (index - 1)
              else if (data[deletedIndex - 1]) {
                newSelection = data[deletedIndex - 1]
              }
              // Fallback to first household
              else {
                newSelection = data[0]
              }
            } else {
              // Fallback to first household
              newSelection = data[0]
            }

            setSelectedHousehold(newSelection)
            setRequiresHouseholdCreation(false)
            // Update localStorage with new selection
            localStorage.setItem('selectedHouseholdId', newSelection.id)
          } else if (!selectedHousehold) {
            // No household selected yet - select first
            setSelectedHousehold(data[0])
            setRequiresHouseholdCreation(false)
          }
        }
      } else {
        // Handle different error responses
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))

        if (response.status === 404 && errorData.error?.includes('User not found in database')) {
          // User record doesn't exist - this should now be handled by ensure-user
          // but we can add retry logic as a fallback
          if (retryCount < 2) {
            console.log(
              `Retrying household fetch after user creation issue (attempt ${retryCount + 1})`
            )
            setTimeout(() => fetchHouseholds(retryCount + 1), 1000)
            return
          }
        }

        console.error('Failed to fetch households:', response.status, errorData)
        // For now, still trigger household creation as a fallback
        setHouseholds([])
        setSelectedHousehold(null)
        setRequiresHouseholdCreation(true)
      }
    } catch (error) {
      console.error('Failed to fetch households:', error)
      // Network error or other issue - try again if this is the first attempt
      if (retryCount < 1) {
        console.log(`Retrying household fetch after network error (attempt ${retryCount + 1})`)
        setTimeout(() => fetchHouseholds(retryCount + 1), 1000)
        return
      }
      // Fallback to household creation
      setHouseholds([])
      setSelectedHousehold(null)
      setRequiresHouseholdCreation(true)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshHouseholds = async () => {
    setIsLoading(true)
    await fetchHouseholds()
  }

  const selectHousehold = (household: Household) => {
    setSelectedHousehold(household)
    setRequiresHouseholdCreation(false)
    // Store selection in localStorage for persistence
    localStorage.setItem('selectedHouseholdId', household.id)
  }

  const triggerHouseholdCreation = () => {
    setRequiresHouseholdCreation(true)
  }

  const completeHouseholdCreation = async () => {
    setRequiresHouseholdCreation(false)
    await refreshHouseholds()
  }

  const getUserRole = (householdId?: string): string | undefined => {
    const targetHouseholdId = householdId || selectedHousehold?.id
    if (!targetHouseholdId) return undefined

    const household = households.find((h) => h.id === targetHouseholdId)
    return household?.userRole
  }

  useEffect(() => {
    fetchHouseholds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Restore selected household from localStorage
  useEffect(() => {
    const savedHouseholdId = localStorage.getItem('selectedHouseholdId')
    if (savedHouseholdId && households.length > 0) {
      const savedHousehold = households.find((h) => h.id === savedHouseholdId)
      if (savedHousehold) {
        setSelectedHousehold(savedHousehold)
      }
    }
  }, [households])

  const value: HouseholdContextType = {
    households,
    selectedHousehold,
    isLoading,
    requiresHouseholdCreation,
    selectHousehold,
    refreshHouseholds,
    triggerHouseholdCreation,
    completeHouseholdCreation,
    getUserRole,
  }

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold() {
  const context = useContext(HouseholdContext)
  if (context === undefined) {
    throw new Error('useHousehold must be used within a HouseholdProvider')
  }
  return context
}
