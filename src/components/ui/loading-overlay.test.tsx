import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingOverlay } from './loading-overlay'

describe('LoadingOverlay', () => {
  it('renders nothing when show is false', () => {
    const { container } = render(<LoadingOverlay show={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders overlay with default message when show is true', () => {
    render(<LoadingOverlay show={true} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders overlay with custom message', () => {
    render(<LoadingOverlay show={true} message="Uploading..." />)
    expect(screen.getByText('Uploading...')).toBeInTheDocument()
  })
})
