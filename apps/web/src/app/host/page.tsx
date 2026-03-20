"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HostPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home since a specific game must be chosen
    router.push('/');
  }, [router]);

  return null;
}
