// A slow network or a waking server can delay a heartbeat, so a device is never
// declared offline sooner than this, however short its heartbeat interval.
const MIN_STALE_SECONDS = 30;

export function buildDeviceHealth(device, fallbackFreshness = 15) {
  if (!device?.last_seen_at) {
    return { ...device, is_online: false, stale_seconds: null };
  }

  const expectedInterval = device.heartbeat_interval_seconds || fallbackFreshness;
  const maxAllowedStale = Math.max(expectedInterval * 2.5, MIN_STALE_SECONDS);

  const staleSeconds = Math.floor((Date.now() - new Date(device.last_seen_at).getTime()) / 1000);
  return {
    ...device,
    stale_seconds: staleSeconds,
    is_online: staleSeconds <= maxAllowedStale
  };
}
