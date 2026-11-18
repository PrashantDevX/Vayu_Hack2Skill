import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AqiBadge } from './AqiBadge'

describe('AqiBadge', () => {
  it('shows both the category and numeric value, not colour alone', () => {
    render(<AqiBadge aqi={287} category="Poor" prefix="AQI" />)
    expect(screen.getByRole('status')).toHaveTextContent('AQI Poor · 287')
    expect(screen.getByRole('status')).toHaveClass('category-pill', 'poor')
  })

  it('shows an explicit unavailable state when no overall index exists', () => {
    render(<AqiBadge aqi={null} category={null} />)
    expect(screen.getByRole('status')).toHaveTextContent('AQI unavailable')
  })
})
