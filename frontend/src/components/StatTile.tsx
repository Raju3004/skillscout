import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function StatTile({
  label,
  value,
  suffix = "",
  decimals = 0,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  const animated = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl px-5 py-4"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-mist-400">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-mist-100">
        {animated.toFixed(decimals)}
        <span className="text-base text-mist-400">{suffix}</span>
      </p>
    </motion.div>
  );
}
