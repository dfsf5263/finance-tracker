import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Popover, PopoverTrigger, PopoverContent } from './popover'

describe('Popover', () => {
  it('renders popover trigger', () => {
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Content</PopoverContent>
      </Popover>
    )

    expect(screen.getByText('Open')).toBeInTheDocument()
  })

  it('renders popover content when open', () => {
    render(
      <Popover open>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
      </Popover>
    )

    expect(screen.getByText('Popover body')).toBeInTheDocument()
  })
})
