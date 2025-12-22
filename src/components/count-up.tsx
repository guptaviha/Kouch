"use client";

import React, { useEffect, useState } from 'react';
import { animate } from 'framer-motion';

type CountUpProps = {
  from: number;
  to: number;
  duration?: number;
  delay?: number;
};

export default function CountUp({ from, to, duration = 1.5, delay = 0 }: CountUpProps) {
  const [value, setValue] = useState(from);

  useEffect(() => {
    const controls = animate(from, to, {
      duration,
      delay,
      onUpdate: (v) => setValue(Math.round(v)),
      ease: 'easeOut',
    });
    return () => controls.stop();
  }, [from, to, duration, delay]);

  return <>{value}</>;
}
