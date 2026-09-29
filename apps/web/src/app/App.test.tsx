import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { App } from './App'

test('renders the Hive product identity', async () => {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <App />
    </MemoryRouter>,
  )

  expect(await screen.findByRole('heading', { name: 'Hive' })).toBeInTheDocument()
  expect(screen.getByText('The operating layer for event devices.')).toBeInTheDocument()
})
