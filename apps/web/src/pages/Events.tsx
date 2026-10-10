import { useEffect, useState } from "react";

import { EventModal } from "../components/events/EventModal";
import { type Event, getEvents } from "../lib/api";

function formatDateRange(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const start = formatter.format(new Date(`${startDate}T00:00:00`));
  const end = formatter.format(new Date(`${endDate}T00:00:00`));

  return startDate === endDate ? start : `${start} - ${end}`;
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvents() {
      try {
        setIsLoading(true);
        setError(null);

        const loadedEvents = await getEvents();
        setEvents(loadedEvents);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load events.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadEvents();
  }, []);

  function handleEventCreated(createdEvent: Event) {
    setEvents((currentEvents) =>
      [...currentEvents, createdEvent].sort((first, second) =>
        first.start_date.localeCompare(second.start_date),
      ),
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">OPERATIONS</p>
          <h2>Events</h2>
          <p>Plan shows and manage device allocations.</p>
        </div>

        <button
          className="primary-button"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          Create event
        </button>
      </header>

      <section className="content-card">
        {isLoading && <p>Loading events...</p>}

        {!isLoading && error && (
          <div>
            <h3>Events could not be loaded</h3>
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && events.length === 0 && (
          <div>
            <h3>No events yet</h3>
            <p>Create your first event to begin planning device allocations.</p>
          </div>
        )}

        {!isLoading && !error && events.length > 0 && (
          <div className="event-list">
            {events.map((event) => (
              <article className="event-card" key={event.id}>
                <div>
                  <p className="eyebrow">{event.venue}</p>
                  <h3>{event.name}</h3>
                  <p>{formatDateRange(event.start_date, event.end_date)}</p>
                </div>

                <span
                  className={`status-badge status-${event.status.toLowerCase()}`}
                >
                  {formatStatus(event.status)}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      <EventModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleEventCreated}
      />
    </>
  );
}