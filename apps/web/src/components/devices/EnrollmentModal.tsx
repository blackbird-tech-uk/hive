import {
  Check,
  Clipboard,
  LoaderCircle,
  X,
} from 'lucide-react'
import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import QRCode from 'react-qr-code'

import {
  createEnrollmentToken,
  type EnrollmentTokenCreatedResponse,
} from '../../lib/api'
interface EnrollmentModalProps {
  isOpen: boolean
  onClose: () => void
}

const DEFAULT_EXPIRY_HOURS = 24
const DEFAULT_MAX_USES = 1

function formatExpiry(value: string): string {
  const expiry = new Date(value)

  if (Number.isNaN(expiry.getTime())) {
    return 'Unknown'
  }

  return expiry.toLocaleString('en-GB')
}

export function EnrollmentModal({
  isOpen,
  onClose,
}: EnrollmentModalProps) {
  const [label, setLabel] = useState('')
  const [expiresInHours, setExpiresInHours] =
    useState(DEFAULT_EXPIRY_HOURS)
  const [maxUses, setMaxUses] = useState(
    DEFAULT_MAX_USES,
  )

  const [createdToken, setCreatedToken] =
  useState<EnrollmentTokenCreatedResponse | null>(
    null,
  )

  const [isCreating, setIsCreating] =
    useState(false)

  const [error, setError] = useState<
    string | null
  >(null)

  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === 'Escape' &&
        !isCreating
      ) {
        onClose()
      }
    }

    document.addEventListener(
      'keydown',
      handleKeyDown,
    )

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      )
    }
  }, [isCreating, isOpen, onClose])

  function resetModal() {
    setLabel('')
    setExpiresInHours(DEFAULT_EXPIRY_HOURS)
    setMaxUses(DEFAULT_MAX_USES)
    setCreatedToken(null)
    setError(null)
    setCopied(false)
  }

  function handleClose() {
    if (isCreating) {
      return
    }

    resetModal()
    onClose()
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError(null)
    setCopied(false)

    if (
      expiresInHours < 1 ||
      expiresInHours > 720
    ) {
      setError(
        'Expiry must be between 1 and 720 hours.',
      )
      return
    }

    if (maxUses < 1 || maxUses > 1000) {
      setError(
        'Maximum uses must be between 1 and 1,000.',
      )
      return
    }

    setIsCreating(true)

    try {
      const response =
        await createEnrollmentToken({
          label: label.trim() || undefined,
          expires_in_hours: expiresInHours,
          max_uses: maxUses,
        })

      setCreatedToken(response)
    } catch (creationError) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : 'Unable to create the enrolment token.',
      )
    } finally {
      setIsCreating(false)
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

      setCopied(true)

      window.setTimeout(() => {
        setCopied(false)
      }, 2_000)
    } catch {
      setError(
        'The token could not be copied automatically.',
      )
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      aria-labelledby="enrollment-modal-title"
      aria-modal="true"
      className="modal-backdrop"
      role="dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose()
        }
      }}
    >
      <section className="modal-card enrollment-modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow">
              DEVICE ENROLMENT
            </p>

            <h2 id="enrollment-modal-title">
              {createdToken
                ? 'Enrolment token ready'
                : 'Enrol a device'}
            </h2>

            <p>
              {createdToken
                ? 'Scan the QR code using the Hive Agent or enter the token manually.'
                : 'Create a temporary token that allows an Android device to join this organisation.'}
            </p>
          </div>

          <button
            aria-label="Close enrolment modal"
            className="icon-button"
            disabled={isCreating}
            onClick={handleClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        {createdToken ? (
          <div className="enrollment-result">
            <div className="enrollment-qr-code">
              <QRCode
                aria-label="Device enrolment QR code"
                size={220}
                value={createdToken.token}
                viewBox="0 0 256 256"
              />
            </div>

            <div className="enrollment-token-details">
              <div>
                <span className="field-label">
                  Enrolment token
                </span>

                <div className="enrollment-token-value">
                  <code>
                    {createdToken.token}
                  </code>

                  <button
                    aria-label="Copy enrolment token"
                    className="icon-button"
                    onClick={() => void copyToken()}
                    type="button"
                  >
                    {copied ? (
                      <Check
                        aria-hidden="true"
                        size={17}
                      />
                    ) : (
                      <Clipboard
                        aria-hidden="true"
                        size={17}
                      />
                    )}
                  </button>
                </div>
              </div>

              <dl className="device-details-grid">
                <div>
                  <dt>Expires</dt>
                  <dd>
                    {formatExpiry(
                      createdToken.expires_at,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Maximum uses</dt>
                  <dd>{createdToken.max_uses}</dd>
                </div>

                <div>
                  <dt>Uses</dt>
                  <dd>{createdToken.use_count}</dd>
                </div>

                <div>
                  <dt>Label</dt>
                  <dd>
                    {createdToken.label ??
                      'No label'}
                  </dd>
                </div>
              </dl>

              <p className="form-help">
                This plaintext token is only shown
                once. Store it securely until the
                device has enrolled.
              </p>
            </div>
          </div>
        ) : (
          <form
            className="enrollment-form"
            onSubmit={(event) =>
              void handleSubmit(event)
            }
          >
            <label className="form-field">
              <span>Label</span>

              <input
                disabled={isCreating}
                maxLength={150}
                onChange={(event) =>
                  setLabel(event.target.value)
                }
                placeholder="Example: Warehouse scanners"
                type="text"
                value={label}
              />

              <small>
                Optional description for identifying
                this token later.
              </small>
            </label>

            <div className="form-grid">
              <label className="form-field">
                <span>Expires after</span>

                <div className="input-with-suffix">
                  <input
                    disabled={isCreating}
                    max={720}
                    min={1}
                    onChange={(event) =>
                      setExpiresInHours(
                        Number(event.target.value),
                      )
                    }
                    required
                    type="number"
                    value={expiresInHours}
                  />

                  <span>hours</span>
                </div>
              </label>

              <label className="form-field">
                <span>Maximum uses</span>

                <input
                  disabled={isCreating}
                  max={1000}
                  min={1}
                  onChange={(event) =>
                    setMaxUses(
                      Number(event.target.value),
                    )
                  }
                  required
                  type="number"
                  value={maxUses}
                />
              </label>
            </div>

            {error && (
              <p
                className="form-error"
                role="alert"
              >
                {error}
              </p>
            )}

            <footer className="modal-footer">
              <button
                className="secondary-button"
                disabled={isCreating}
                onClick={handleClose}
                type="button"
              >
                Cancel
              </button>

              <button
                className="primary-button"
                disabled={isCreating}
                type="submit"
              >
                {isCreating && (
                  <LoaderCircle
                    aria-hidden="true"
                    size={16}
                  />
                )}

                {isCreating
                  ? 'Creating...'
                  : 'Create Enrolment Token'}
              </button>
            </footer>
          </form>
        )}

        {createdToken && error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {createdToken && (
          <footer className="modal-footer">
            <button
              className="primary-button"
              onClick={handleClose}
              type="button"
            >
              Done
            </button>
          </footer>
        )}
      </section>
    </div>
  )
}