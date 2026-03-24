const LOCAL_WEB_PORT = 3000;

export function getRealtimeBaseUrl(): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_WEB_BASE_URL;
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (typeof window === 'undefined') {
    return `http://localhost:${LOCAL_WEB_PORT}`;
  }

  return window.location.origin;
}
