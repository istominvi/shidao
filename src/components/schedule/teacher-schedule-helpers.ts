export type CarouselScheduleEvent = {
  id: string;
  startsAt: string;
  endsAt: string;
};

export function findDefaultCenteredEventIndex(
  events: CarouselScheduleEvent[],
  nowIso: string,
): number {
  if (events.length === 0) {
    return -1;
  }

  const sorted = events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt));

  const nowTs = Date.parse(nowIso);

  const inProgress = sorted.findIndex(({ event }) => {
    const startTs = Date.parse(event.startsAt);
    const endTs = Date.parse(event.endsAt);
    return startTs <= nowTs && endTs >= nowTs;
  });

  if (inProgress >= 0) {
    return sorted[inProgress]!.index;
  }

  const upcoming = sorted.findIndex(({ event }) => Date.parse(event.startsAt) >= nowTs);
  if (upcoming >= 0) {
    return sorted[upcoming]!.index;
  }

  return sorted[sorted.length - 1]!.index;
}
