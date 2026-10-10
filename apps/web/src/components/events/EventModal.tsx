import { useState, type FormEvent } from "react";

import {
  createEvent,
  type CreateEventPayload,
  type Event,
  type EventStatus,
} from "../../lib/api";

type EventModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (event: Event) => void;
};

const initialForm: CreateEventPayload = {
  name: "",
  venue: "",
  start_date: "",
  end_date: "",
  status: "planned",
  notes: "",
};

export function EventModal({
  open,
  onClose,
  onCreated,
}: EventModalProps) {
  const [form, setForm] = useState<CreateEventPayload>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  function updateField(
    field: keyof CreateEventPayload,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function closeModal() {
    if (isSubmitting) {
      return;
    }

    setForm(initialForm);
    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.end_date < form.start_date) {
      setError("The end date cannot be before the start date.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const createdEvent = await createEvent(form);

      onCreated(createdEvent);
      setForm(initialForm);
      onClose();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create the event.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={closeModal}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-event-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">NEW EVENT</p>
            <h2 id="create-event-title">Create event</h2>
          </div>

          <button
            className="modal-close-button"
            type="button"
            onClick={closeModal}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form className="event-form" onSubmit={handleSubmit}>
          <label>
            <span>Event name</span>
            <input
              required
              value={form.name}
              onChange={(event) =>
                updateField("name", event.target.value)
              }
              placeholder="Coffee Fest London"
            />
          </label>

          <label>
            <span>Venue</span>
            <input
              required
              value={form.venue}
              onChange={(event) =>
                updateField("venue", event.target.value)
              }
              placeholder="Business Design Centre"
            />
          </label>

          <div className="form-row">
            <label>
              <span>Start date</span>
              <input
                required
                type="date"
                value={form.start_date}
                onChange={(event) =>
                  updateField("start_date", event.target.value)
                }
              />
            </label>

            <label>
              <span>End date</span>
              <input
                required
                type="date"
                min={form.start_date || undefined}
                value={form.end_date}
                onChange={(event) =>
                  updateField("end_date", event.target.value)
                }
              />
            </label>
          </div>

          <label>
            <span>Status</span>
            <select
              value={form.status}
              onChange={(event) =>
                updateField(
                  "status",
                  event.target.value as EventStatus,
                )
              }
            >
              <option value="draft">Draft</option>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>

          <label>
            <span>Notes</span>
            <textarea
              rows={4}
              value={form.notes ?? ""}
              onChange={(event) =>
                updateField("notes", event.target.value)
              }
              placeholder="Build day information, organiser notes, staffing..."
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={closeModal}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              className="primary-button"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}