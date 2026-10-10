import { Event } from "../../lib/api";
import { EventCard } from "./EventCard";

type Props = {
  events: Event[];
};

export function EventList({ events }: Props) {
  return (
    <div className="event-list">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
        />
      ))}
    </div>
  );
}