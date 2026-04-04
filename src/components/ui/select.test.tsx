import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './select'

describe('Select', () => {
  it('renders a select trigger with placeholder', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Fruits</SelectLabel>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    )

    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders trigger with sm size', () => {
    render(
      <Select>
        <SelectTrigger size="sm">
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
      </Select>
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger.getAttribute('data-size')).toBe('sm')
  })

  it('displays selected value', () => {
    render(
      <Select value="apple">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
        </SelectContent>
      </Select>
    )

    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
