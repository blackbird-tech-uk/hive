import {
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react'
import {
  useEffect,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../app/AuthContext'

export function LoginPage() {
  const navigate = useNavigate()

  const {
    login,
    isAuthenticated,
  } = useAuth()

  const [username, setUsername] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [error, setError] =
    useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] =
    useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', {
        replace: true,
      })
    }
  }, [isAuthenticated, navigate])

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError(null)
    setIsSubmitting(true)

    try {
      await login(
        username.trim(),
        password,
      )

      navigate('/dashboard', {
        replace: true,
      })
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Unable to sign in.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <div className="login-brand-logo">
            H
          </div>

          <div>
            <strong>Hive</strong>
            <span>
              Blackbird Device Operations
            </span>
          </div>
        </div>

        <div className="login-heading">
          <div className="login-icon">
            <ShieldCheck
              size={24}
              aria-hidden="true"
            />
          </div>

          <p className="eyebrow">
            SECURE ACCESS
          </p>

          <h1>Sign in to Hive</h1>

          <p>
            Manage devices, events and field
            operations from one secure platform.
          </p>
        </div>

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >
          <label>
            <span>Username</span>

            <input
              autoComplete="username"
              autoFocus
              disabled={isSubmitting}
              onChange={(event) =>
                setUsername(
                  event.target.value,
                )
              }
              required
              type="text"
              value={username}
            />
          </label>

          <label>
            <span>Password</span>

            <div className="login-password-field">
              <LockKeyhole
                size={18}
                aria-hidden="true"
              />

              <input
                autoComplete="current-password"
                disabled={isSubmitting}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                required
                type="password"
                value={password}
              />
            </div>
          </label>

          {error && (
            <div
              className="login-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            className="login-submit"
            disabled={
              isSubmitting ||
              !username.trim() ||
              !password
            }
            type="submit"
          >
            {isSubmitting
              ? 'Signing in…'
              : 'Sign in'}
          </button>
        </form>
      </section>

      <aside className="login-visual">
        <div>
          <p className="eyebrow">
            BLACKBIRD SYSTEMS
          </p>

          <h2>
            Device control built for live
            operations.
          </h2>

          <p>
            Monitor fleet health, enrollment,
            connectivity and event assignments
            from anywhere.
          </p>
        </div>
      </aside>
    </main>
  )
}