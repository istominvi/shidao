import { z } from "zod";

/**
 * PostgreSQL's uuid type accepts the canonical 8-4-4-4-12 representation
 * without requiring RFC version or variant bits. Persisted database IDs may
 * therefore be valid UUID values even when `z.uuid()` rejects them.
 */
export const postgresUuidSchema = z.guid();
