'use client'

import { useState, useEffect, useRef } from 'react'
import { D3Sankey } from './d3-sankey'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Filter } from 'lucide-react'
import {
  getDateRange,
  getMonthName,
  getCurrentYear,
  getCurrentMonth,
  getCurrentQuarter,
} from '@/lib/utils'
import { useHousehold } from '@/contexts/household-context'

interface SankeyData {
  nodes: Array<{ name: string; type: 'income' | 'user' | 'expense' }>
  links: Array<{ source: number; target: number; value: number; type: 'income' | 'expense' }>
}

interface DateRanges {
  years: number[]
  currentYear: number
  currentMonth: number
}

interface TimePeriod {
  type: 'all' | 'year' | 'month' | 'quarter'
  year: number
  month: number
  quarter: number
}

const COLORS = [
  'oklch(var(--chart-1))',
  'oklch(var(--chart-2))',
  'oklch(var(--chart-3))',
  'oklch(var(--chart-4))',
  'oklch(var(--chart-5))',
  '#82CA9D',
  '#FFC658',
  '#FF7C7C',
  '#8DD1E1',
  '#D084D0',
]

export function AnalyticsMoneyFlow() {
  const { selectedHousehold } = useHousehold()
  const [sankeyData, setSankeyData] = useState<SankeyData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>({
    type: 'month',
    year: getCurrentYear(),
    month: getCurrentMonth(),
    quarter: getCurrentQuarter(),
  })
  const [dateRanges, setDateRanges] = useState<DateRanges>({
    years: [],
    currentYear: getCurrentYear(),
    currentMonth: getCurrentMonth(),
  })
  const [containerWidth, setContainerWidth] = useState(1000)
  const sankeyContainerRef = useRef<HTMLDivElement>(null)

  // Helper function to convert timePeriod to start/end dates
  const getDateRangeFromPeriod = (period: TimePeriod): { startDate: string; endDate: string } => {
    return getDateRange(period.type, period.year, period.month, period.quarter)
  }

  const fetchSankeyData = async () => {
    if (!selectedHousehold) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        householdId: selectedHousehold.id,
      })

      const dateRange = getDateRangeFromPeriod(timePeriod)
      if (dateRange.startDate) params.append('startDate', dateRange.startDate)
      if (dateRange.endDate) params.append('endDate', dateRange.endDate)
      // Note: typeFilter is intentionally not applied to Money Flow visualization
      // as it inherently separates income/expense using isOutflow flag

      const response = await fetch(`/api/transactions/sankey?${params}`)
      if (response.ok) {
        const data = await response.json()
        setSankeyData(data)
      } else {
        console.error('API Error:', await response.json())
        setSankeyData({ nodes: [], links: [] })
      }
    } catch (error) {
      console.error('Error fetching sankey data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch date ranges when household changes
  useEffect(() => {
    const fetchDateRanges = async () => {
      if (!selectedHousehold) return
      try {
        const response = await fetch(
          `/api/transactions/date-ranges?householdId=${selectedHousehold.id}`
        )
        if (response.ok) {
          const data = await response.json()
          setDateRanges(data)
          // Update initial time period with current data
          setTimePeriod((prev) => ({
            ...prev,
            year: data.currentYear,
            month: data.currentMonth,
          }))
        }
      } catch (error) {
        console.error('Error fetching date ranges:', error)
      }
    }

    if (selectedHousehold) {
      fetchDateRanges()
    }
  }, [selectedHousehold])

  // Measure container width for responsive Sankey diagram
  useEffect(() => {
    const updateContainerWidth = () => {
      if (sankeyContainerRef.current) {
        const rect = sankeyContainerRef.current.getBoundingClientRect()
        // Set minimum width of 800px, use container width minus padding
        const availableWidth = Math.max(800, rect.width - 48) // 48px for padding
        setContainerWidth(availableWidth)
      }
    }

    // Initial measurement
    updateContainerWidth()

    // Create ResizeObserver to monitor container size changes
    const resizeObserver = new ResizeObserver(updateContainerWidth)
    if (sankeyContainerRef.current) {
      resizeObserver.observe(sankeyContainerRef.current)
    }

    // Also listen to window resize as fallback
    window.addEventListener('resize', updateContainerWidth)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateContainerWidth)
    }
  }, [])

  useEffect(() => {
    fetchSankeyData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timePeriod, selectedHousehold])

  if (!selectedHousehold) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Please select a household to view money flow.
      </div>
    )
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading money flow...</div>
  }

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <Card>
        <CardHeader className="p-6">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <Label htmlFor="periodType" className="text-sm font-medium">
                Time Period:
              </Label>
              <Select
                value={timePeriod.type}
                onValueChange={(value) =>
                  setTimePeriod((prev) => ({
                    ...prev,
                    type: value as 'all' | 'year' | 'month' | 'quarter',
                  }))
                }
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="year">By Year</SelectItem>
                  <SelectItem value="month">By Month</SelectItem>
                  <SelectItem value="quarter">By Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(timePeriod.type === 'year' ||
              timePeriod.type === 'month' ||
              timePeriod.type === 'quarter') && (
              <div>
                <Label htmlFor="year" className="text-sm font-medium">
                  Year:
                </Label>
                <Select
                  value={timePeriod.year.toString()}
                  onValueChange={(value) =>
                    setTimePeriod((prev) => ({ ...prev, year: parseInt(value) }))
                  }
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dateRanges.years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {timePeriod.type === 'month' && (
              <div>
                <Label htmlFor="month" className="text-sm font-medium">
                  Month:
                </Label>
                <Select
                  value={timePeriod.month.toString()}
                  onValueChange={(value) =>
                    setTimePeriod((prev) => ({ ...prev, month: parseInt(value) }))
                  }
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {getMonthName(month)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {timePeriod.type === 'quarter' && (
              <div>
                <Label htmlFor="quarter" className="text-sm font-medium">
                  Quarter:
                </Label>
                <Select
                  value={timePeriod.quarter.toString()}
                  onValueChange={(value) =>
                    setTimePeriod((prev) => ({ ...prev, quarter: parseInt(value) }))
                  }
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Q1</SelectItem>
                    <SelectItem value="2">Q2</SelectItem>
                    <SelectItem value="3">Q3</SelectItem>
                    <SelectItem value="4">Q4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {sankeyData.nodes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No data available for the selected period
        </div>
      ) : (
        <div className="grid grid-cols-1">
          <Card>
            <CardHeader className="p-6">
              <CardTitle>Money Flow: Income → Users → Expenses</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div ref={sankeyContainerRef} className="h-[600px] overflow-x-auto">
                <div className="w-full h-full flex justify-center min-w-[800px]">
                  <D3Sankey data={sankeyData} width={containerWidth} height={600} colors={COLORS} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
