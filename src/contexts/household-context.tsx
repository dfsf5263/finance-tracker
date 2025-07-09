'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface Household {
  id: string
  name: string
  annualBudget?: number | null
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
  selectHousehold: (household: Household) => void
  refreshHouseholds: () => Promise<void>
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined)

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [households, setHouseholds] = useState<Household[]>([])
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchHouseholds = async () => {
    try {
      const response = await fetch('/api/households')
      if (response.ok) {
        const data = await response.json()
        setHouseholds(data)
        
        // Auto-select first household if none selected
        if (!selectedHousehold && data.length > 0) {
          setSelectedHousehold(data[0])
        }
      }
    } catch (error) {
      console.error('Failed to fetch households:', error)
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
    // Store selection in localStorage for persistence
    localStorage.setItem('selectedHouseholdId', household.id)
  }

  useEffect(() => {
    fetchHouseholds()
  }, [])

  // Restore selected household from localStorage
  useEffect(() => {
    const savedHouseholdId = localStorage.getItem('selectedHouseholdId')
    if (savedHouseholdId && households.length > 0) {
      const savedHousehold = households.find(h => h.id === savedHouseholdId)
      if (savedHousehold) {
        setSelectedHousehold(savedHousehold)
      }
    }
  }, [households])

  const value: HouseholdContextType = {
    households,
    selectedHousehold,
    isLoading,
    selectHousehold,
    refreshHouseholds,
  }

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const context = useContext(HouseholdContext)
  if (context === undefined) {
    throw new Error('useHousehold must be used within a HouseholdProvider')
  }
  return context
}