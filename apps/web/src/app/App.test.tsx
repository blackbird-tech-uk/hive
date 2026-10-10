import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { App } from './App'

test('renders the Hive product identity', async () => {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <App />
    </MemoryRouter>,
  )

  expect(await screen.findByRole('heading', { name: 'Sign in to Hive' })).toBeInTheDocument()
  expect(screen.getByText('Hive')).toBeInTheDocument()
  expect(screen.getByText('Blackbird Device Operations')).toBeInTheDocument()
})
