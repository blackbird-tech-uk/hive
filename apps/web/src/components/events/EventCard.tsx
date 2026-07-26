import { CalendarDays, MapPin } from "lucide-react";
import { Event } from "../../lib/api";

type EventCardProps = {
  event: Event;
  onClick?: () => void;
};

export function EventCard({ event, onClick }: EventCardProps) {
  return (
    <article className="event-card" onClick={onClick}>
      <div className="event-card-header">
        <div>
          <h3>{event.name}</h3>
          <p className="event-venue">
            <MapPin size={14} />
            {event.venue}
          </p>
        </div>

        <span className={`status-badge status-${event.status}`}>
          {event.status}
        </span>
      </div>

      <div className="event-card-footer">
        <span>
          <CalendarDays size={14} />
          {event.start_date} → {event.end_date}
        </span>
      </div>
    </article>
  );
}