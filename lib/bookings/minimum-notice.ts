const LISBON_DATETIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Lisbon',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function isBeforeMinimumBookingNotice(
  date: string,
  time: string,
  minimumNoticeMinutes: number,
  now = new Date(),
): boolean {
  const configuredMinutes = Number(minimumNoticeMinutes);
  const noticeMinutes = Number.isFinite(configuredMinutes)
    ? Math.max(0, Math.min(43200, Math.trunc(configuredMinutes)))
    : 0;
  const cutoff = new Date(now.getTime() + noticeMinutes * 60_000);
  const parts = LISBON_DATETIME_FORMATTER.formatToParts(cutoff);
  const field = (name: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === name)?.value ?? '';
  const cutoffLocal = `${field('year')}-${field('month')}-${field('day')}T${field('hour')}:${field('minute')}:${field('second')}`;
  const requestedLocal = `${date}T${time.slice(0, 5)}:00`;
  return requestedLocal < cutoffLocal;
}
