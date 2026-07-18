import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * A deliberately small, short-lived presence record.
 *
 * We do not store an IP address, precise location, user agent, voice content,
 * or any other user profile data. `eventId` is supplied by the client so a
 * retried tap is idempotent.
 */
export const poopEvents = sqliteTable(
  "poop_events",
  {
    eventId: text("event_id").primaryKey(),
    roomId: text("room_id").notNull(),
    countryCode: text("country_code").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    source: text("source", { enum: ["live", "synthetic"] })
      .notNull()
      .default("live"),
  },
  (table) => [
    index("poop_events_expires_at_idx").on(table.expiresAt),
    index("poop_events_country_created_idx").on(
      table.countryCode,
      table.createdAt,
    ),
    index("poop_events_room_created_idx").on(table.roomId, table.createdAt),
  ],
);
