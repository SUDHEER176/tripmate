import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function DiaText({
  words,
  duration = 2200,
  className,
  gradient,
  ...props
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!words || words.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, duration);

    return () => clearInterval(interval);
  }, [words, duration]);

  const bgGradient =
    gradient ||
    "linear-gradient(90deg, currentColor 50%, #38BDF8 50%, #F43F5E, #FB923C, #A855F7)";

  return (
    <span
      className={cn(
        "relative inline-block overflow-hidden min-w-[2ch] align-bottom",
        className,
      )}
      style={{ verticalAlign: "bottom" }}
      {...props}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ y: "100%", opacity: 0, filter: "blur(4px)" }}
          animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
          exit={{ y: "-100%", opacity: 0, filter: "blur(4px)" }}
          transition={{
            y: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
            filter: { duration: 0.2 },
          }}
          className="absolute inset-0 inline-flex items-center justify-center sm:justify-start"
        >
          <motion.span
            className="inline-block bg-clip-text pb-1"
            style={{
              WebkitTextFillColor: "transparent",
              backgroundImage: bgGradient,
              backgroundSize: "250% 100%",
            }}
            initial={{
              backgroundPosition: "100% 0%",
            }}
            animate={{
              backgroundPosition: "0% 0%",
            }}
            transition={{
              duration: 0.8,
              ease: "easeInOut",
              delay: 0.1,
            }}
          >
            {words[index]}
          </motion.span>
        </motion.span>
      </AnimatePresence>

      {/* Spacer for layout stability */}
      <span className="invisible select-none opacity-0" aria-hidden="true">
        {words[index]}
      </span>
    </span>
  );
}

export default DiaText;
