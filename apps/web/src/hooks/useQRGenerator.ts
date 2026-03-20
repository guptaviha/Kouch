import { useEffect } from 'react';
import QRCode from 'qrcode';
import { useGameStore } from '@/lib/store';

export function useQRGenerator(roomCode: string | null) {
  const setQrDataUrl = useGameStore((s) => s.setQrDataUrl);
  const setJoinUrl = useGameStore((s) => s.setJoinUrl);

  useEffect(() => {
    if (!roomCode) {
      setQrDataUrl(null);
      setJoinUrl(null);
      return;
    }

    let originForQr = '';
    if (typeof window !== 'undefined') {
      const { protocol, hostname, port } = window.location;
      const envLan = process.env.NEXT_PUBLIC_LAN_HOST;
      const invalidLoopbacks = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
      const LAN_HOST = envLan && !invalidLoopbacks.includes(envLan) ? envLan : window.location.hostname;
      const hostForQr = (hostname === 'localhost' || hostname === '127.0.0.1') ? LAN_HOST : hostname;
      const portPart = port ? `:${port}` : '';
      originForQr = `${protocol}//${hostForQr}${portPart}`;
    }

    const url = `${originForQr}/player?code=${roomCode}`;
    setJoinUrl(url);
    QRCode.toDataURL(url, { margin: 1, width: 300 })
      .then((dataUrl: string) => setQrDataUrl(dataUrl))
      .catch(() => setQrDataUrl(null));
  }, [roomCode, setQrDataUrl, setJoinUrl]);
}