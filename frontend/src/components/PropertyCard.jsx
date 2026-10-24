import { MapPin } from "lucide-react";
import { AmenityTile } from "./AmenityTile";

export function PropertyCard({ property, index }) {
  const gaps = property.amenities.filter((a) => a.active_count === 0).length;
  return (
    <article
      className="card p-5 sm:p-6 animate-rise"
      style={{ animationDelay: `${index * 80}ms` }}
      data-testid={`property-card-${property.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl text-espresso" data-testid={`property-card-${property.id}-name`}>{property.name}</h2>
          <p className="mt-1 flex items-center gap-1 text-sm text-cocoa">
            <MapPin size={14} aria-hidden /> {property.city}
          </p>
        </div>
        {gaps > 0 ? (
          <span className="badge badge-warn">{gaps} {gaps === 1 ? "gap" : "gaps"}</span>
        ) : (
          <span className="badge badge-ready">All covered</span>
        )}
      </div>
      {property.amenities.length === 0 ? (
        <p className="mt-4 text-sm text-cocoa">No amenities yet.</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {property.amenities.map((a) => <AmenityTile key={a.id} amenity={a} />)}
        </div>
      )}
    </article>
  );
}
