'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { formatDateForInput, parseInputDate } from '@/lib/utils'

interface CustomDatePickerProps {
  value?: string
  onChange: (date: string) => void
  placeholder?: string
  className?: string
}

export function CustomDatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
}: CustomDatePickerProps) {
  // Convert string date to Date object for the date picker
  const selectedDate = value ? parseInputDate(value) : null

  const handleChange = (date: Date | null) => {
    if (date) {
      // Format as YYYY-MM-DD for HTML date input compatibility
      const formatted = formatDateForInput(date)
      onChange(formatted)
    }
  }

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => (
      <Button
        ref={ref}
        onClick={onClick}
        variant="outline"
        className={cn(
          'w-full justify-start text-left font-normal',
          !value && 'text-muted-foreground',
          className
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? format(parseInputDate(value), 'PPP') : <span>{placeholder}</span>}
      </Button>
    )
  )
  CustomInput.displayName = 'CustomInput'

  return (
    <DatePicker
      selected={selectedDate}
      onChange={handleChange}
      customInput={<CustomInput value={value} />}
      dateFormat="yyyy-MM-dd"
      className="w-full"
      popperClassName="z-50"
      popperPlacement="bottom-start"
    />
  )
}
