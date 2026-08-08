import React from "react";
import { MotiView } from "moti";

export default function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 350, delay }}
    >
      {children}
    </MotiView>
  );
}
