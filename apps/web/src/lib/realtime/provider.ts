export type RealtimeProvider = 'partykit' | 'socketio';

const DEFAULT_REALTIME_PROVIDER: RealtimeProvider = 'partykit';

export function getRealtimeProvider(value = process.env.NEXT_PUBLIC_REALTIME_PROVIDER): RealtimeProvider {
  return value === 'socketio' ? 'socketio' : DEFAULT_REALTIME_PROVIDER;
}

export function isPartyKitRealtimeEnabled(value = process.env.NEXT_PUBLIC_REALTIME_PROVIDER): boolean {
  return getRealtimeProvider(value) === 'partykit';
}

export function assertPartyKitRealtimeEnabled(value = process.env.NEXT_PUBLIC_REALTIME_PROVIDER): void {
  if (!isPartyKitRealtimeEnabled(value)) {
    throw new Error('PartyKit bootstrap is disabled while NEXT_PUBLIC_REALTIME_PROVIDER=socketio.');
  }
}
