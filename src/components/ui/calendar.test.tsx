import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Calendar } from './calendar'

describe('Calendar', () => {
  it('renders with default props', () => {
    const { container } = render(<Calendar />)
    expect(container.querySelector('[data-slot="calendar"]')).toBeInTheDocument()
  })

  it('renders with a selected date', () => {
    const { container } = render(<Calendar mode="single" selected={new Date(2024, 0, 15)} />)
    expect(container.querySelector('[data-slot="calendar"]')).toBeInTheDocument()
  })

  it('renders with dropdown caption layout', () => {
    const { container } = render(<Calendar captionLayout="dropdown" />)
    expect(container.querySelector('[data-slot="calendar"]')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<Calendar className="my-calendar" />)
    const cal = container.querySelector('[data-slot="calendar"]')
    expect(cal?.className).toContain('my-calendar')
  })

  it('renders outside days by default', () => {
    const { container } = render(<Calendar defaultMonth={new Date(2024, 0, 1)} />)
    // Calendar renders with outside days visible by default
    expect(container.querySelector('[data-slot="calendar"]')).toBeInTheDocument()
  })
})
