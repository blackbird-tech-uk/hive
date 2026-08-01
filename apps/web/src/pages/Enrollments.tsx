import {
  Copy,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import QRCode from 'react-qr-code'

import {
  createEnrollmentToken,
  getEnrollmentTokens,
  revokeEnrollmentToken,
  type EnrollmentTokenCreatedResponse,
  type EnrollmentTokenResponse,
} from '../lib/api'

function formatDateTime(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getTokenStatus(
  token: EnrollmentTokenResponse,
): 'active' | 'expired' | 'revoked' | 'used' {
  if (token.revoked_at) {
    return 'revoked'
  }

  if (new Date(token.expires_at).getTime() <= Date.now()) {
    return 'expired'
  }

  if (token.use_count >= token.max_uses) {
    return 'used'
  }

  return 'active'
}

export function EnrollmentsPage() {
  const [tokens, setTokens] = useState<
    EnrollmentTokenResponse[]
  >([])

  const [createdToken, setCreatedToken] =
    useState<EnrollmentTokenCreatedResponse | null>(
      null,
    )

  const [label, setLabel] = useState('')
  const [expiresInHours, setExpiresInHours] =
    useState(24)
  const [maxUses, setMaxUses] = useState(1)

  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [revokingId, setRevokingId] = useState<
    string | null
  >(null)

  const [notice, setNotice] = useState<
    string | null
  >(null)
  const [error, setError] = useState<
    string | null
  >(null)

  const loadTokens = useCallback(async () => {
    try {
      setLoading(true)

      const loadedTokens =
        await getEnrollmentTokens()

      setTokens(loadedTokens)
      setError(null)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load enrollment tokens.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTokens()
  }, [loadTokens])

  const qrValue = useMemo(() => {
    if (!createdToken) {
      return ''
    }

    return JSON.stringify({
      type: 'hive-enrollment',
      version: 1,
      server_url:
        import.meta.env.VITE_API_BASE_URL ??
        'http://localhost:8000/api/v1',
      token: createdToken.token,
    })
  }, [createdToken])

  async function handleCreate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setCreating(true)
      setNotice(null)
      setError(null)

      const response =
        await createEnrollmentToken({
          label: label.trim() || undefined,
          expires_in_hours: expiresInHours,
          max_uses: maxUses,
        })

      setCreatedToken(response)
      setLabel('')

      setNotice(
        'Enrollment token created successfully.',
      )

      await loadTokens()
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Unable to create enrollment token.',
      )
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(
    tokenId: string,
  ) {
    try {
      setRevokingId(tokenId)
      setNotice(null)
      setError(null)

      const revokedToken =
        await revokeEnrollmentToken(tokenId)

      setTokens((currentTokens) =>
        currentTokens.map((token) =>
          token.id === revokedToken.id
            ? revokedToken
            : token,
        ),
      )

      setNotice(
        'Enrollment token revoked successfully.',
      )
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : 'Unable to revoke enrollment token.',
      )
    } finally {
      setRevokingId(null)
    }
  }

  async function copyToken() {
    if (!createdToken) {
      return
    }

    try {
      await navigator.clipboard.writeText(
        createdToken.token,
      )

      setNotice(
        'Enrollment token copied to clipboard.',
      )
    } catch {
      setError(
        'Unable to copy the enrollment token.',
      )
    }
  }

  return (
    <section className="enrollments-page">
      <header className="enrollments-header">
        <div>
          <p className="eyebrow">
            ANDROID DEVICE ONBOARDING
          </p>

          <h1>Enrollments</h1>

          <p>
            Generate secure, time-limited QR codes
            for enrolling Android devices into Hive.
          </p>
        </div>

        <button
          className="secondary-button"
          disabled={loading}
          onClick={() => void loadTokens()}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={loading ? 'spin' : ''}
            size={17}
          />

          Refresh
        </button>
      </header>

      {notice && (
        <p
          className="device-dashboard-command-notice"
          role="status"
        >
          {notice}
        </p>
      )}

      {error && (
        <p
          className="device-dashboard-command-error"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="enrollments-layout">
        <section className="enrollment-panel">
          <div className="enrollment-panel-header">
            <div>
              <p className="eyebrow">
                CREATE TOKEN
              </p>

              <h2>New enrollment</h2>
            </div>

            <Plus
              aria-hidden="true"
              size={20}
            />
          </div>

          <form
            className="enrollment-form"
            onSubmit={handleCreate}
          >
            <label>
              Token label

              <input
                maxLength={150}
                onChange={(event) =>
                  setLabel(event.target.value)
                }
                placeholder="Warehouse EA660 devices"
                type="text"
                value={label}
              />
            </label>

            <label>
              Expires after

              <select
                onChange={(event) =>
                  setExpiresInHours(
                    Number(event.target.value),
                  )
                }
                value={expiresInHours}
              >
                <option value={1}>1 hour</option>
                <option value={4}>4 hours</option>
                <option value={24}>24 hours</option>
                <option value={72}>3 days</option>
                <option value={168}>7 days</option>
              </select>
            </label>

            <label>
              Maximum uses

              <input
                max={1000}
                min={1}
                onChange={(event) =>
                  setMaxUses(
                    Number(event.target.value),
                  )
                }
                type="number"
                value={maxUses}
              />
            </label>

            <button
              className="primary-button"
              disabled={creating}
              type="submit"
            >
              <ShieldCheck
                aria-hidden="true"
                size={17}
              />

              {creating
                ? 'Generating...'
                : 'Generate enrollment QR'}
            </button>
          </form>
        </section>

        <section className="enrollment-panel">
          <div className="enrollment-panel-header">
            <div>
              <p className="eyebrow">
                ENROLLMENT QR
              </p>

              <h2>Scan with Hive Agent</h2>
            </div>
          </div>

          {createdToken ? (
            <div className="enrollment-qr-result">
              <div className="enrollment-qr-code">
                <QRCode
                  size={220}
                  value={qrValue}
                  viewBox="0 0 220 220"
                />
              </div>

              <div className="enrollment-created-details">
                <div>
                  <span>Token prefix</span>
                  <strong>
                    {createdToken.token_prefix}
                  </strong>
                </div>

                <div>
                  <span>Expires</span>
                  <strong>
                    {formatDateTime(
                      createdToken.expires_at,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Maximum uses</span>
                  <strong>
                    {createdToken.max_uses}
                  </strong>
                </div>
              </div>

              <div className="enrollment-token-value">
                <code>{createdToken.token}</code>

                <button
                  aria-label="Copy enrollment token"
                  className="icon-button"
                  onClick={() => void copyToken()}
                  type="button"
                >
                  <Copy
                    aria-hidden="true"
                    size={17}
                  />
                </button>
              </div>

              <p className="enrollment-token-warning">
                This plaintext token is only returned
                once. Store it securely or generate a
                new token later.
              </p>
            </div>
          ) : (
            <div className="device-dashboard-empty">
              <p>
                Generate a token to display its QR
                enrollment code.
              </p>
            </div>
          )}
        </section>
      </div>

      <section className="enrollment-panel">
        <div className="enrollment-panel-header">
          <div>
            <p className="eyebrow">
              TOKEN MANAGEMENT
            </p>

            <h2>Enrollment tokens</h2>
          </div>
        </div>

        {loading && tokens.length === 0 ? (
          <div className="device-dashboard-empty">
            <p>Loading enrollment tokens...</p>
          </div>
        ) : tokens.length === 0 ? (
          <div className="device-dashboard-empty">
            <p>
              No enrollment tokens have been
              created yet.
            </p>
          </div>
        ) : (
          <div className="enrollment-table-wrapper">
            <table className="enrollment-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Prefix</th>
                  <th>Status</th>
                  <th>Uses</th>
                  <th>Expires</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {tokens.map((token) => {
                  const tokenStatus =
                    getTokenStatus(token)

                  return (
                    <tr key={token.id}>
                      <td>
                        <strong>
                          {token.label ??
                            'Unnamed enrollment'}
                        </strong>
                      </td>

                      <td>
                        <code>
                          {token.token_prefix}
                        </code>
                      </td>

                      <td>
                        <span
                          className={`enrollment-status enrollment-status-${tokenStatus}`}
                        >
                          {tokenStatus}
                        </span>
                      </td>

                      <td>
                        {token.use_count} /{' '}
                        {token.max_uses}
                      </td>

                      <td>
                        {formatDateTime(
                          token.expires_at,
                        )}
                      </td>

                      <td>
                        {formatDateTime(
                          token.created_at,
                        )}
                      </td>

                      <td>
                        <button
                          aria-label="Revoke enrollment token"
                          className="icon-button"
                          disabled={
                            tokenStatus !== 'active' ||
                            revokingId === token.id
                          }
                          onClick={() =>
                            void handleRevoke(
                              token.id,
                            )
                          }
                          type="button"
                        >
                          <Trash2
                            aria-hidden="true"
                            size={16}
                          />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}