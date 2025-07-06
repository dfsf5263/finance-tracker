'use client'

import { useState, useEffect, useRef } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { D3Sankey } from './d3-sankey'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'

interface AnalyticsData {
  name: string
  value: number
  originalValue?: number // Original value (can be negative)
  count: number
}

interface TransactionType {
  id: string
  name: string
}

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
  type: 'all' | 'year' | 'month'
  year: number
  month: number
}

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884D8',
  '#82CA9D',
  '#FFC658',
  '#FF7C7C',
  '#8DD1E1',
  '#D084D0',
]

export function AnalyticsChart() {
  const [data, setData] = useState<AnalyticsData[]>([])
  const [sankeyData, setSankeyData] = useState<SankeyData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [visualizationType, setVisualizationType] = useState<'donut' | 'sankey'>('donut')
  const [groupBy, setGroupBy] = useState('category')
  const [timePeriod, setTimePeriod] = useState<TimePeriod>({
    type: 'month',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  })
  const [typeFilter, setTypeFilter] = useState('all')
  const [types, setTypes] = useState<TransactionType[]>([])
  const [dateRanges, setDateRanges] = useState<DateRanges>({
    years: [],
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
  })
  const [containerWidth, setContainerWidth] = useState(1000)
  const sankeyContainerRef = useRef<HTMLDivElement>(null)

  // Helper function to convert timePeriod to start/end dates
  const getDateRangeFromPeriod = (period: TimePeriod): { startDate: string; endDate: string } => {
    if (period.type === 'all') {
      return { startDate: '', endDate: '' }
    }

    if (period.type === 'year') {
      const startDate = `${period.year}-01-01`
      const endDate = `${period.year}-12-31`
      return { startDate, endDate }
    }

    if (period.type === 'month') {
      const year = period.year
      const month = period.month.toString().padStart(2, '0')
      const startDate = `${year}-${month}-01`

      // Get last day of month
      const lastDay = new Date(year, period.month, 0).getDate()
      const endDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`

      return { startDate, endDate }
    }

    return { startDate: '', endDate: '' }
  }

  // Helper function to get month names
  const getMonthName = (monthNumber: number): string => {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]
    return months[monthNumber - 1] || ''
  }

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        groupBy,
      })

      const dateRange = getDateRangeFromPeriod(timePeriod)
      if (dateRange.startDate) params.append('startDate', dateRange.startDate)
      if (dateRange.endDate) params.append('endDate', dateRange.endDate)
      if (typeFilter && typeFilter !== 'all') params.append('typeId', typeFilter)

      const response = await fetch(`/api/transactions/analytics?${params}`)
      if (response.ok) {
        const analyticsData = await response.json()
        // Transform data to ensure pie chart gets absolute values
        // while preserving original values for display
        const transformedData = analyticsData.map((item: AnalyticsData) => ({
          ...item,
          originalValue: item.value, // Preserve original value
          value: Math.abs(item.value), // Use absolute value for pie chart
        }))
        setData(transformedData)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSankeyData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      const dateRange = getDateRangeFromPeriod(timePeriod)
      if (dateRange.startDate) params.append('startDate', dateRange.startDate)
      if (dateRange.endDate) params.append('endDate', dateRange.endDate)
      if (typeFilter && typeFilter !== 'all') params.append('typeId', typeFilter)

      const response = await fetch(`/api/transactions/sankey?${params}`)
      if (response.ok) {
        const data = await response.json()
        setSankeyData(data)
      }
    } catch (error) {
      console.error('Error fetching sankey data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch types and date ranges on mount
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const response = await fetch('/api/types')
        if (response.ok) {
          const data = await response.json()
          setTypes(data)
        }
      } catch (error) {
        console.error('Error fetching types:', error)
      }
    }

    const fetchDateRanges = async () => {
      try {
        const response = await fetch('/api/transactions/date-ranges')
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

    fetchTypes()
    fetchDateRanges()
  }, [])

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
  }, [visualizationType])

  useEffect(() => {
    if (visualizationType === 'donut') {
      fetchAnalytics()
    } else {
      fetchSankeyData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualizationType, groupBy, timePeriod, typeFilter])

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{ payload: AnalyticsData }>
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      // Use originalValue if available, otherwise use value
      const displayValue = data.originalValue !== undefined ? data.originalValue : data.value
      return (
        <div className="bg-card p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-gray-600">Amount: {formatCurrency(displayValue)}</p>
          <p className="text-sm text-gray-600">Transactions: {data.count}</p>
        </div>
      )
    }
    return null
  }

  // Custom slice label component
  const RADIAN = Math.PI / 180
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderSliceLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, name, index } = props

    if (!cx || !cy || midAngle === undefined || !innerRadius || !outerRadius || !percent) {
      return null
    }
    // Only show label if slice is significant enough (> 5%)
    if (percent < 0.05) return null

    const radius = innerRadius + (outerRadius - innerRadius) * 1.3
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    const isLeftSide = x < cx
    const textAnchor = isLeftSide ? 'end' : 'start'
    const color = COLORS[index % COLORS.length]

    // Calculate text metrics for background
    const textLength = name ? name.length * 7 : 0 // Approximate width
    const padding = 8
    const rectX = isLeftSide ? x - textLength - padding : x - padding / 2
    const rectY = y - 12
    const rectWidth = textLength + padding * 2
    const rectHeight = 24

    return (
      <g>
        {/* Background rectangle */}
        <rect
          x={rectX}
          y={rectY}
          width={rectWidth}
          height={rectHeight}
          rx="4"
          ry="4"
          fill="white"
          fillOpacity="0.9"
          stroke={color}
          strokeWidth="1.5"
        />
        {/* Text */}
        <text
          x={x}
          y={y}
          fill={color}
          textAnchor={textAnchor}
          dominantBaseline="central"
          fontSize="14"
          fontWeight="500"
        >
          {name}
        </text>
      </g>
    )
  }

  // Custom label line component
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderCustomLabelLine = (props: any) => {
    const { percent, points, index } = props

    // Don't draw label line if slice is too small - return empty element
    if (percent < 0.05) return <g />

    // Draw the default label line
    if (!points || points.length < 2) return <g />

    const color = COLORS[index % COLORS.length]

    return (
      <polyline
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        points={`${points[0].x},${points[0].y} ${points[1].x},${points[1].y}`}
      />
    )
  }

  // Calculate total using original values if available
  const totalAmount = data.reduce((sum, item) => {
    const valueToUse = item.originalValue !== undefined ? item.originalValue : item.value
    return sum + valueToUse
  }, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted rounded-lg">
        <div className="flex gap-4">
          <div>
            <Label htmlFor="visualizationType" className="text-sm font-medium">
              Visualization:
            </Label>
            <Select
              value={visualizationType}
              onValueChange={(value) => setVisualizationType(value as 'donut' | 'sankey')}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="donut">Breakdown</SelectItem>
                <SelectItem value="sankey">Money Flow</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {visualizationType === 'donut' && (
            <div>
              <Label htmlFor="groupBy" className="text-sm font-medium">
                Group by:
              </Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="source">Source</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {visualizationType === 'donut' && (
            <div>
              <Label htmlFor="typeFilter" className="text-sm font-medium">
                Filter by Type:
              </Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {types.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <div>
            <Label htmlFor="periodType" className="text-sm font-medium">
              Time Period:
            </Label>
            <Select
              value={timePeriod.type}
              onValueChange={(value) =>
                setTimePeriod((prev) => ({ ...prev, type: value as 'all' | 'year' | 'month' }))
              }
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="year">By Year</SelectItem>
                <SelectItem value="month">By Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(timePeriod.type === 'year' || timePeriod.type === 'month') && (
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
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading analytics...</div>
      ) : (visualizationType === 'donut' && data.length === 0) ||
        (visualizationType === 'sankey' && sankeyData.nodes.length === 0) ? (
        <div className="text-center py-8 text-muted-foreground">
          No data available for the selected period
        </div>
      ) : visualizationType === 'donut' ? (
        <div className="space-y-6">
          <div className="bg-card p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              Transactions by{' '}
              {groupBy === 'category' ? 'Category' : groupBy === 'user' ? 'User' : 'Source'}
            </h3>
            <div className="h-[500px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={renderCustomLabelLine}
                    label={renderSliceLabel}
                    innerRadius={100}
                    outerRadius={180}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="font-medium text-foreground">Total Amount:</span>
                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(totalAmount)}
                </span>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Breakdown:</h4>
                {data.map((item, index) => (
                  <div
                    key={item.name}
                    className="flex justify-between items-center p-2 border-l-4 border-l-border"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm text-foreground">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-foreground">
                        {formatCurrency(
                          item.originalValue !== undefined ? item.originalValue : item.value
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.count} transactions</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1">
          <div className="bg-card p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              Money Flow: Income → Users → Expenses
            </h3>
            <div ref={sankeyContainerRef} className="h-[600px] overflow-x-auto">
              <div className="w-full h-full flex justify-center min-w-[800px]">
                <D3Sankey data={sankeyData} width={containerWidth} height={600} colors={COLORS} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
