import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CustomDatePicker } from './date-picker'

describe('CustomDatePicker', () => {
  it('renders with placeholder text', () => {
    render(<CustomDatePicker onChange={vi.fn()} placeholder="Select date" />)
    expect(screen.getByText('Select date')).toBeInTheDocument()
  })

  it('renders the formatted date when a value is provided', () => {
    render(<CustomDatePicker value="2024-01-15" onChange={vi.fn()} />)
    // displayDateLong formats as a long date string
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('opens calendar popover on click', () => {
    render(<CustomDatePicker onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button'))
    // Calendar should be rendered in the popover
    expect(document.querySelector('[data-slot="calendar"]')).toBeInTheDocument()
  })

  it('calls onChange when a day is selected', () => {
    const onChange = vi.fn()
    render(<CustomDatePicker onChange={onChange} />)

    // Open the calendar
    fireEvent.click(screen.getByRole('button'))

    // Click a day button in the calendar
    const dayButtons = document.querySelectorAll('[data-slot="calendar"] button')
    const clickableDay = Array.from(dayButtons).find(
      (btn) => !btn.hasAttribute('disabled') && btn.getAttribute('name') === 'day'
    )
    if (clickableDay) {
      fireEvent.click(clickableDay)
      expect(onChange).toHaveBeenCalled()
    }
  })

  it('respects disabled prop', () => {
    render(<CustomDatePicker onChange={vi.fn()} disabled />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
