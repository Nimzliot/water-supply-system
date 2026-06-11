export function buildDeviceHealth(device, fallbackFreshness = 3) {
  if (!device?.last_seen_at) {
    return { ...device, is_online: false, stale_seconds: null };
  }

  const expectedInterval = device.heartbeat_interval_seconds || fallbackFreshness;
  const maxAllowedStale = expectedInterval * 2.5; 

  const staleSeconds = Math.floor((Date.now() - new Date(device.last_seen_at).getTime()) / 1000);
  return {
    ...device,
    stale_seconds: staleSeconds,
    is_online: staleSeconds <= maxAllowedStale
  };
}

