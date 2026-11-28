type RelatedServiceCapacity = {
  duration?: number | string | null;
  buffer_minutes?: number | string | null;
};

export type AppointmentCapacitySource = {
  duration_minutes?: number | string | null;
  buffer_minutes?: number | string | null;
  services?: RelatedServiceCapacity | RelatedServiceCapacity[] | null;
};

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Use the larger of the stored appointment snapshot and the linked service
 * capacity. Older dashboard-created recurring bookings could inherit the
 * database's 30-minute default instead of the selected service's duration.
 */
export function getReservedAppointmentMinutes(
  appointment: AppointmentCapacitySource,
): number {
  const service = Array.isArray(appointment.services)
    ? appointment.services[0]
    : appointment.services;
  const snapshotDuration = finiteNumber(appointment.duration_minutes, 0);
  const serviceDuration = finiteNumber(service?.duration, 30);
  const duration = Math.min(
    Math.max(Math.round(snapshotDuration), Math.round(serviceDuration), 1),
    1440,
  );

  const snapshotBuffer = finiteNumber(appointment.buffer_minutes, 0);
  const serviceBuffer = finiteNumber(service?.buffer_minutes, 0);
  const buffer = Math.min(
    Math.max(Math.round(snapshotBuffer), Math.round(serviceBuffer), 0),
    120,
  );

  return duration + buffer;
}
