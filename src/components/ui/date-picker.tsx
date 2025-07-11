'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toISODateString, parseISODate } from '@/lib/utils'

interface CustomDatePickerProps {
  value?: string
  onChange: (date: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  maxDate?: Date
}

export function CustomDatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  disabled = false,
  maxDate = new Date(),
}: CustomDatePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Convert ISO date string to Date object for the calendar
  const selectedDate = value ? parseISODate(value) : undefined

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Format as ISO date string (YYYY-MM-DD)
      const formatted = toISODateString(date)
      onChange(formatted)
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(parseISODate(value), 'PPP') : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          defaultMonth={selectedDate || new Date()}
          initialFocus
          disabled={(date) => date > maxDate}
        />
      </PopoverContent>
    </Popover>
  )
}
