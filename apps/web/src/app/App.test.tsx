import { render, screen } from '@testing-library/react'

import { App } from './App'

test('renders the Hive product identity', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Hive' })).toBeInTheDocument()
  expect(screen.getByText('The operating layer for event devices.')).toBeInTheDocument()
})
