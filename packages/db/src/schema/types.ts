import { customType } from 'drizzle-orm/pg-core';

/** Case-insensitive text (extension citext): emails, nicknames. */
export const citext = customType<{ data: string }>({ dataType: () => 'citext' });

/** Raw bytes: hashes stored as bytea (domain sha256_hash). */
export const bytea = customType<{ data: Uint8Array }>({ dataType: () => 'bytea' });

export interface GeoPoint {
  longitude: number;
  latitude: number;
}

/**
 * PostGIS geography(Point, 4326). Written as EWKT; read it with ST_X / ST_Y in the query
 * (the driver returns hex EWKB, which we never parse in application code).
 */
export const geographyPoint = customType<{ data: GeoPoint; driverData: string }>({
  dataType: () => 'geography(Point, 4326)',
  toDriver: ({ longitude, latitude }) => `SRID=4326;POINT(${longitude} ${latitude})`,
});

/** timestamptz as a JS Date, the default for every model in this package. */
export const TIMESTAMPTZ = { withTimezone: true, mode: 'date' } as const;
