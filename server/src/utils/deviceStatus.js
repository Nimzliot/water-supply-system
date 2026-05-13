export function buildDeviceHealth(device, freshnessSeconds) {
  if (!device?.last_seen_at) {
    return { ...device, is_online: false, stale_seconds: null };
  }

  const staleSeconds = Math.floor((Date.now() - new Date(device.last_seen_at).getTime()) / 1000);
  return {
    ...device,
    stale_seconds: staleSeconds,
    is_online: staleSeconds <= freshnessSeconds
  };
}

