import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Progress } from './progress'

describe('Progress', () => {
  it('renders with a value', () => {
    render(<Progress value={50} aria-label="uploading" />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders with value 0', () => {
    render(<Progress value={0} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Progress value={25} className="custom-class" />)
    const bar = screen.getByRole('progressbar')
    expect(bar.className).toContain('custom-class')
  })
})
