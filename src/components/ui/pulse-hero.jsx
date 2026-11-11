import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function PulseFitHero({
  logo = "TripMate AI",
  navigation = [{ label: "Explore" }, { label: "Pricing" }],
  ctaButton,
  badge,
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  disclaimer,
  socialProof,
  programs = [],
  className,
  children,
}) {
  const cardWidth = 356;
  const cardGap = 24;
  const totalItemWidth = cardWidth + cardGap;
  const loopDistance = programs.length * totalItemWidth;

  return (
    <section
      className={cn(
        "relative w-full min-h-screen flex flex-col overflow-hidden bg-white text-neutral-900 border-b border-neutral-200",
        className,
      )}
      style={{
        background:
          "linear-gradient(180deg, #FFFFFF 0%, #F9F9F9 50%, #FFFFFF 100%)",
      }}
      role="banner"
      aria-label="Hero section"
    >
      {/* Background Soft Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,0,0,0.03),transparent_70%)]" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-20 flex flex-row justify-between items-center px-6 sm:px-8 lg:px-16"
        style={{
          paddingTop: "24px",
          paddingBottom: "24px",
        }}
      >
        {/* Logo */}
        <div className="cursor-pointer font-display text-2xl font-bold text-neutral-950 flex items-center gap-2">
          {logo}
        </div>

        {/* Navigation */}
        <nav
          className="hidden lg:flex flex-row items-center gap-8"
          aria-label="Main navigation"
        >
          {navigation.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="flex flex-row items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-950 transition-colors"
            >
              {item.label}
              {item.hasDropdown && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 6L8 10L12 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </nav>

        {/* CTA Button */}
        {ctaButton && (
          <button
            onClick={ctaButton.onClick}
            className="px-5 py-2.5 rounded-full transition-all hover:scale-105 text-sm font-semibold cursor-pointer shadow-sm hover:shadow-md border border-neutral-300 bg-neutral-950 text-white hover:bg-neutral-800"
          >
            {ctaButton.label}
          </button>
        )}
      </motion.header>

      {/* Main Content */}
      {children ? (
        <div className="relative z-10 flex-1 flex items-center justify-center w-full">
          {children}
        </div>
      ) : (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pt-4 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col items-center text-center max-w-4xl"
            style={{ gap: "24px" }}
          >
            {/* Optional Badge */}
            {badge && (
              <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-900 shadow-sm">
                {badge}
              </div>
            )}

            {/* Title */}
            <h1
              className="font-display font-bold text-neutral-950 tracking-tight"
              style={{
                fontSize: "clamp(36px, 5.5vw, 68px)",
                lineHeight: "1.12",
                letterSpacing: "-0.02em",
              }}
            >
              {title}
            </h1>

            {/* Subtitle */}
            <p
              className="text-neutral-600"
              style={{
                fontSize: "clamp(16px, 1.8vw, 19px)",
                lineHeight: "1.6",
                maxWidth: "680px",
              }}
            >
              {subtitle}
            </p>

            {/* Action Buttons */}
            {(primaryAction || secondaryAction) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex flex-col sm:flex-row items-center gap-4 mt-2"
              >
                {primaryAction && (
                  <button
                    onClick={primaryAction.onClick}
                    className="flex flex-row items-center gap-2 px-8 py-3.5 rounded-full transition-all hover:scale-105 cursor-pointer shadow-lg shadow-black/10 bg-neutral-950 text-white hover:bg-neutral-800 font-semibold text-base"
                  >
                    {primaryAction.label}
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M7 10H13M13 10L10 7M13 10L10 13"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}

                {secondaryAction && (
                  <button
                    onClick={secondaryAction.onClick}
                    className="flex flex-row items-center gap-2 px-8 py-3.5 rounded-full transition-all hover:scale-105 cursor-pointer border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 font-semibold text-base shadow-sm"
                  >
                    {secondaryAction.label}
                  </button>
                )}
              </motion.div>
            )}

            {/* Social Proof */}
            {socialProof && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex flex-row items-center gap-3 mt-2"
              >
                <div className="flex flex-row -space-x-2.5">
                  {socialProof.avatars.map((avatar, index) => (
                    <img
                      key={index}
                      src={avatar}
                      alt={`Traveler ${index + 1}`}
                      className="rounded-full border-2 border-white shadow-sm"
                      style={{
                        width: "38px",
                        height: "38px",
                        objectFit: "cover",
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs sm:text-sm font-medium text-neutral-600">
                  {socialProof.text}
                </span>
              </motion.div>
            )}

            {/* Disclaimer */}
            {disclaimer && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.7 }}
                className="text-xs text-neutral-500 font-medium"
              >
                {disclaimer}
              </motion.p>
            )}
          </motion.div>
        </div>
      )}

      {/* Program Cards Carousel */}
      {programs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.6 }}
          className="relative z-10 w-full overflow-hidden mt-6 pb-12 pt-4"
        >
          {/* Gradient Overlays on Left & Right */}
          <div
            className="absolute left-0 top-0 bottom-0 z-10 pointer-events-none"
            style={{
              width: "120px",
              background:
                "linear-gradient(90deg, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%)",
            }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 z-10 pointer-events-none"
            style={{
              width: "120px",
              background:
                "linear-gradient(270deg, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%)",
            }}
          />

          {/* Scrolling Container */}
          <motion.div
            className="flex items-center"
            animate={{
              x: [0, -loopDistance],
            }}
            transition={{
              x: {
                repeat: Infinity,
                repeatType: "loop",
                duration: programs.length * 4.5,
                ease: "linear",
              },
            }}
            style={{
              gap: `${cardGap}px`,
              paddingLeft: `${cardGap}px`,
            }}
          >
            {/* Duplicate programs twice for silky smooth infinite loop */}
            {[...programs, ...programs, ...programs].map((program, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.04, y: -6 }}
                transition={{ duration: 0.25 }}
                onClick={program.onClick}
                className="flex-shrink-0 cursor-pointer relative overflow-hidden group rounded-3xl"
                style={{
                  width: `${cardWidth}px`,
                  height: "440px",
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
                  border: "1px solid rgba(0, 0, 0, 0.06)",
                }}
              >
                {/* Image */}
                <img
                  src={program.image}
                  alt={program.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Gradient Overlay */}
                <div
                  className="absolute inset-0 transition-opacity duration-300"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0, 0, 0, 0.05) 0%, rgba(0, 0, 0, 0.25) 50%, rgba(0, 0, 0, 0.8) 100%)",
                  }}
                />

                {/* Text Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-white/80 uppercase tracking-widest">
                    {program.category}
                  </span>
                  <h3 className="font-display text-2xl font-semibold text-white leading-tight">
                    {program.title}
                  </h3>
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/90 font-medium">
                    <span>Plan this route</span>
                    <span className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </section>
  );
}
