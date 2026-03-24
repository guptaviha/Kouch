const LOCAL_REALTIME_PORT = 1999;

export function getRealtimeBaseUrl(): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_REALTIME_BASE_URL;
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (typeof window === 'undefined') {
    return `http://localhost:${LOCAL_REALTIME_PORT}`;
  }

  return `http://${window.location.hostname}:${LOCAL_REALTIME_PORT}`;
}
