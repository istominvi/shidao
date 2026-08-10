import { parseComponentPayload, type ComponentTypeKey } from "./contracts";

/**
 * Returns StoredFile reference occurrences in payload order. Slideshow
 * duplicates are intentionally preserved so each consumer can choose between
 * occurrence-aware rendering and its own explicit deduplication policy.
 */
export function extractComponentStoredFileReferences(
  typeKey: ComponentTypeKey,
  payload: unknown,
): string[] {
  const parsed = parseComponentPayload(typeKey, payload);

  switch (typeKey) {
    case "image":
    case "file": {
      const storedFileId = (parsed as { storedFileId: string | null })
        .storedFileId;
      return storedFileId ? [storedFileId] : [];
    }
    case "slideshow":
      return (parsed as { slides: Array<{ storedFileId: string }> }).slides.map(
        (slide) => slide.storedFileId,
      );
    default:
      return [];
  }
}
