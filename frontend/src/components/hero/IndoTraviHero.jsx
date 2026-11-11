import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  MapPin,
  Menu,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSmoothScroll } from "@/context/SmoothScrollContext";
import { TripMateLogo } from "@/components/brand/TripMateLogo";
import { RouteStops } from "@/components/home/shared";
import { destinations } from "@/lib/destinations";
import userHeroVideo from "@/assets/videos/45569-443244046_medium.mp4";

const ease = [0.22, 1, 0.36, 1];

const dayOptions = [3, 5, 7, 10];
const budgetOptions = [
  { value: 25000, label: "₹25,000" },
  { value: 50000, label: "₹50,000" },
  { value: 100000, label: "₹1,00,000" },
  { value: 200000, label: "₹2,00,000" },
];

const navTargets = ["#about", "#services", "#tour", "#blog", "#contact"];

const copy = {
  en: {
    navItems: [
      "Destinations",
      "How it works",
      "Trip ideas",
      "Journal",
      "Contact",
    ],
    title: "Plan every day of your trip, and know what it costs",
    subtitle:
      "Tell us where you’re going and for how long. You get each day’s stops on a map, a price for every one, and a plan you can change.",
    where: "Where to?",
    days: "days",
    plan: "Plan trip",
    login: "Log in",
    myTrips: "My trips",
    menu: "Menu",
    assurances: ["Free plan", "No card needed", "Edit every stop"],
  },
  de: {
    navItems: ["Reiseziele", "So geht’s", "Reiseideen", "Journal", "Kontakt"],
    title: "Planen Sie jeden Reisetag und wissen Sie, was er kostet",
    subtitle:
      "Sagen Sie uns, wohin und wie lange. Sie bekommen die Stopps jedes Tages auf einer Karte, einen Preis für jeden und einen Plan, den Sie ändern können.",
    where: "Wohin?",
    days: "Tage",
    plan: "Reise planen",
    login: "Anmelden",
    myTrips: "Meine Reisen",
    menu: "Menü",
    assurances: [
      "Kostenloser Plan",
      "Keine Karte nötig",
      "Jeder Stopp änderbar",
    ],
  },
};

// The hero's one rich moment: a real-looking day from a TripMate plan.
const sampleDay = {
  place: "Lisbon · Day 2 of 5",
  title: "Alfama and Graça",
  total: "₹6,400",
  dailyBudget: "₹10,000",
  usedPct: 64,
  stops: [
    { time: "09:30", name: "Castelo de São Jorge", cost: "₹1,350" },
    { time: "12:30", name: "Lunch at Taberna da Rua", cost: "₹1,800" },
    { time: "14:30", name: "Miradouro da Graça", cost: "Free" },
    { time: "16:00", name: "Tram 28 to Baixa", cost: "₹300" },
    { time: "19:30", name: "Fado dinner in Alfama", cost: "₹2,950" },
  ],
};

function ItineraryCard() {
  return (
    <div className="w-full rounded-2xl bg-white p-5 text-neutral-950 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-950/8 pb-4">
        <div className="min-w-0">
          <p className="text-xs text-neutral-500">{sampleDay.place}</p>
          <p className="mt-1 font-display text-2xl leading-tight tracking-tight">
            {sampleDay.title}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-neutral-500">Day total</p>
          <p className="mt-1 text-lg font-medium tabular-nums">
            {sampleDay.total}
          </p>
        </div>
      </div>

      <RouteStops className="mt-4" stops={sampleDay.stops} />

      <div className="mt-5 border-t border-neutral-950/8 pt-4">
        <div className="flex items-baseline justify-between text-xs text-neutral-500">
          <span>Daily budget</span>
          <span className="tabular-nums">
            {sampleDay.total} of {sampleDay.dailyBudget}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-neutral-950"
            style={{ width: `${sampleDay.usedPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function IndoTraviHero() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scrollTo } = useSmoothScroll();
  const videoRef = useRef(null);

  const [language, setLanguage] = useState("en");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(5);
  const [budget, setBudget] = useState(50000);

  const content = copy[language];
  const accountLink = {
    to: user ? "/my-trips" : "/login",
    label: user ? content.myTrips : content.login,
  };

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  function goTo(idx) {
    setMenuOpen(false);
    scrollTo(navTargets[idx], { offset: -24 });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const params = new URLSearchParams({
      days: String(days),
      budget: String(budget),
    });
    if (destination.trim()) params.set("destination", destination.trim());
    navigate(`/plan-trip?${params}`);
  }

  // One entrance for the main content: a short fade and rise, small stagger.
  const enter = (i) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay: 0.1 + i * 0.05, ease },
  });

  return (
    <section className="relative h-[100svh] min-h-[680px] w-full overflow-hidden bg-neutral-950 text-white">
      {/* Video scene */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src={userHeroVideo} type="video/mp4" />
      </video>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/70" />

      {/* Navbar */}
      <header className="absolute inset-x-0 top-0 z-30 px-5 pt-6 sm:px-10 lg:px-16">
        <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-4">
          <TripMateLogo variant="white" className="h-7 sm:h-8" />

          <nav className="hidden items-center gap-8 text-sm text-white/75 lg:flex">
            {content.navItems.map((item, idx) => (
              <button
                key={item}
                type="button"
                onClick={() => goTo(idx)}
                className="group relative cursor-pointer py-1 transition-colors duration-150 hover:text-white"
              >
                {item}
                <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-white transition-transform duration-200 group-hover:scale-x-100" />
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center rounded-full border border-white/20 p-0.5 text-xs font-medium">
              {["en", "de"].map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  aria-pressed={language === lang}
                  className={`h-8 min-w-10 cursor-pointer rounded-full px-3 transition-colors duration-150 ${
                    language === lang
                      ? "bg-white text-neutral-950"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  {lang === "en" ? "En" : "De"}
                </button>
              ))}
            </div>
            <Link
              to={accountLink.to}
              className="hidden h-10 items-center px-1 text-sm font-medium text-white/85 transition-colors duration-150 hover:text-white sm:inline-flex"
            >
              {accountLink.label}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={content.menu}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/20 text-white transition-colors duration-150 hover:bg-white/10 lg:hidden"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>

          {/* Mobile menu */}
          <AnimatePresence>
            {menuOpen && (
              <motion.nav
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease }}
                className="absolute inset-x-0 top-full mt-3 rounded-2xl bg-white p-2 text-neutral-950 shadow-[0_8px_24px_rgba(0,0,0,0.18)] lg:hidden"
              >
                {content.navItems.map((item, idx) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => goTo(idx)}
                    className="flex h-11 w-full cursor-pointer items-center rounded-xl px-3 text-left text-sm transition-colors duration-150 hover:bg-neutral-100"
                  >
                    {item}
                  </button>
                ))}
                <Link
                  to={accountLink.to}
                  onClick={() => setMenuOpen(false)}
                  className="mt-1 flex h-11 items-center rounded-xl border-t border-neutral-950/8 px-3 text-sm font-medium transition-colors duration-150 hover:bg-neutral-100"
                >
                  {accountLink.label}
                </Link>
              </motion.nav>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Copy + planner, with a sample day on the right */}
      <div className="relative z-20 mx-auto grid h-full max-w-7xl grid-cols-[minmax(0,1fr)] items-end gap-12 px-5 pb-16 sm:px-10 sm:pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-16">
        <div>
          <motion.h1
            {...enter(0)}
            className="max-w-3xl text-balance font-display text-[2.5rem] leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl"
          >
            {content.title}
          </motion.h1>

          <motion.p
            {...enter(1)}
            className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg"
          >
            {content.subtitle}
          </motion.p>

          <motion.form
            {...enter(2)}
            onSubmit={handleSubmit}
            className="mt-8 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl bg-neutral-200 text-neutral-950 shadow-[0_8px_24px_rgba(0,0,0,0.18)] sm:flex sm:rounded-full sm:bg-white sm:p-1.5"
          >
            <label className="col-span-2 flex flex-1 items-center gap-2.5 bg-white px-4 py-3.5 sm:rounded-full sm:py-2">
              <MapPin className="h-4 w-4 shrink-0 text-neutral-500" />
              <input
                list="hero-destinations"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={content.where}
                aria-label={content.where}
                className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-neutral-500"
              />
              <datalist id="hero-destinations">
                {destinations.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.country}
                  </option>
                ))}
              </datalist>
            </label>

            <span className="hidden w-px self-stretch bg-neutral-200 sm:my-2 sm:block" />

            <label className="flex items-center gap-2 bg-white px-4 py-3.5 sm:py-2">
              <Calendar className="h-4 w-4 shrink-0 text-neutral-500" />
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                aria-label="Trip length"
                className="cursor-pointer bg-transparent text-sm outline-none"
              >
                {dayOptions.map((d) => (
                  <option key={d} value={d}>
                    {d} {content.days}
                  </option>
                ))}
              </select>
            </label>

            <span className="hidden w-px self-stretch bg-neutral-200 sm:my-2 sm:block" />

            <label className="flex items-center gap-2 bg-white px-4 py-3.5 sm:py-2">
              <Wallet className="h-4 w-4 shrink-0 text-neutral-500" />
              <select
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                aria-label="Budget"
                className="cursor-pointer bg-transparent text-sm tabular-nums outline-none"
              >
                {budgetOptions.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="group col-span-2 flex h-12 cursor-pointer items-center justify-center gap-2 bg-neutral-950 px-6 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-neutral-800 active:scale-[0.98] sm:h-11 sm:rounded-full"
            >
              {content.plan}
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
            </button>
          </motion.form>

          <motion.ul
            {...enter(3)}
            className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/75"
          >
            {content.assurances.map((item, idx) => (
              <li key={item} className="flex items-center gap-4">
                {idx > 0 && (
                  <span aria-hidden className="h-1 w-1 rounded-full bg-white/40" />
                )}
                {item}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div {...enter(4)} className="hidden lg:block">
          <ItineraryCard />
        </motion.div>
      </div>

      {/* Video controls */}
      <div className="absolute bottom-5 right-5 z-30 hidden items-center gap-1 rounded-full border border-white/15 bg-black/30 p-1 text-white/75 sm:flex">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause video" : "Play video"}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 hover:bg-white/10 hover:text-white"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute video" : "Mute video"}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 hover:bg-white/10 hover:text-white"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </section>
  );
}

export default IndoTraviHero;
