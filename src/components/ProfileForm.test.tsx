import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProfileForm } from './ProfileForm'
import { DEFAULT_PROFILE } from '../constants/aqi'

describe('ProfileForm numeric fields', () => {
  it('allows editing to a blank and then a valid new value', () => {
    const onChange = vi.fn()
    render(<ProfileForm value={DEFAULT_PROFILE} onChange={onChange} section="household" idPrefix="test" />)

    const adults = screen.getByLabelText('Adults (18–64)')
    fireEvent.focus(adults)
    fireEvent.change(adults, { target: { value: '' } })
    expect(adults).toHaveValue(null)

    fireEvent.change(adults, { target: { value: '4' } })
    expect(adults).toHaveValue(4)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ adults: 4 }))
  })

  it('marks out-of-range values invalid and restores the saved value on blur', () => {
    render(<ProfileForm value={DEFAULT_PROFILE} onChange={vi.fn()} section="household" idPrefix="test" />)

    const adults = screen.getByLabelText('Adults (18–64)')
    fireEvent.focus(adults)
    fireEvent.change(adults, { target: { value: '21' } })
    expect(adults).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a value between 0 and 20')

    fireEvent.blur(adults)
    expect(adults).toHaveValue(2)
  })
})
