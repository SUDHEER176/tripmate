import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Calendar, MapPin, Pause, Play, Volume2, VolumeX, Wallet } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSmoothScroll } from "@/context/SmoothScrollContext";
import { TripMateLogo } from "@/components/brand/TripMateLogo";
import { destinations } from "@/lib/destinations";
import userHeroVideo from "../../../45569-443244046_medium.mp4";

const ease = [0.22, 1, 0.36, 1] as const;

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
    navItems: ["Destinations", "How it works", "Trip ideas", "Journal", "Contact"],
    lead: "Your next trip to",
    tail: "planned in minutes.",
    places: ["Kyoto,", "Lisbon,", "Jaipur,", "Bali,", "Hoi An,"],
    subtitle:
      "Day-by-day itineraries, honest budgets in rupees, and a map of every stop. Edit anything, keep everything.",
    where: "Where to?",
    days: "days",
    plan: "Plan trip",
    login: "Log in",
    myTrips: "My trips",
    scroll: "Scroll",
  },
  de: {
    navItems: ["Reiseziele", "So geht’s", "Reiseideen", "Journal", "Kontakt"],
    lead: "Ihre nächste Reise nach",
    tail: "in Minuten geplant.",
    places: ["Kyoto,", "Lissabon,", "Jaipur,", "Bali,", "Hoi An,"],
    subtitle:
      "Tagespläne, ehrliche Budgets und eine Karte jedes Stopps. Alles anpassbar, alles gespeichert.",
    where: "Wohin?",
    days: "Tage",
    plan: "Reise planen",
    login: "Anmelden",
    myTrips: "Meine Reisen",
    scroll: "Scrollen",
  },
};

function RotatingWord({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), 2600);
    return () => clearInterval(id);
  }, [words]);

  return (
    <span className="relative inline-grid overflow-hidden align-bottom">
      {/* Widest word reserves space so the line never jumps */}
      <span className="invisible col-start-1 row-start-1" aria-hidden>
        {words.reduce((a, b) => (b.length > a.length ? b : a))}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={words[index]}
          initial={{ y: "100%" }}
          animate={{ y: "0%" }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.6, ease }}
          className="col-start-1 row-start-1 italic"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function IndoTraviHero() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scrollTo } = useSmoothScroll();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [language, setLanguage] = useState<"de" | "en">("en");
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(5);
  const [budget, setBudget] = useState(50000);

  const content = copy[language];

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ days: String(days), budget: String(budget) });
    if (destination.trim()) params.set("destination", destination.trim());
    navigate(`/plan-trip?${params}`);
  }

  return (
    <section className="relative h-[100svh] min-h-[640px] w-full overflow-hidden bg-neutral-950 text-white">
      {/* Video */}
      <motion.div
        initial={{ scale: 1.08 }}
        animate={{ scale: 1 }}
        transition={{ duration: 2.4, ease }}
        className="absolute inset-0"
      >
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
        >
          <source src={userHeroVideo} type="video/mp4" />
        </video>
      </motion.div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/70" />

      {/* Navbar */}
      <header className="absolute inset-x-0 top-0 z-30 px-5 pt-6 sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <TripMateLogo variant="white" className="h-7 sm:h-8" />

          <nav className="hidden items-center gap-8 text-sm text-white/75 lg:flex">
            {content.navItems.map((item, idx) => (
              <button
                key={item}
                type="button"
                onClick={() => scrollTo(navTargets[idx], { offset: -25, duration: 1.0 })}
                className="group relative cursor-pointer py-1 transition-colors hover:text-white"
              >
                {item}
                <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-white transition-transform duration-300 group-hover:scale-x-100" />
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-full border border-white/20 p-0.5 text-xs font-medium">
              {(["en", "de"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`cursor-pointer rounded-full px-2.5 py-1 uppercase transition-colors ${
                    language === lang ? "bg-white text-neutral-950" : "text-white/70 hover:text-white"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <Link
              to={user ? "/my-trips" : "/login"}
              className="rounded-full bg-white px-5 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-200"
            >
              {user ? content.myTrips : content.login}
            </Link>
          </div>
        </div>
      </header>

      {/* Copy + planner */}
      <div className="relative z-20 mx-auto flex h-full max-w-7xl flex-col justify-end px-5 pb-20 sm:px-10 sm:pb-24 lg:px-16">
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease }}
          className="max-w-4xl font-display text-[2.6rem] leading-[1.02] tracking-tight sm:text-6xl lg:text-[5.25rem]"
        >
          {content.lead} <RotatingWord words={content.places} />
          <br className="hidden sm:block" /> {content.tail}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease }}
          className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg"
        >
          {content.subtitle}
        </motion.p>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease }}
          className="mt-8 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl bg-neutral-200 text-neutral-950 shadow-2xl shadow-black/30 sm:flex sm:rounded-full sm:bg-white sm:p-1.5"
        >
          <label className="col-span-2 flex flex-1 items-center gap-2.5 bg-white px-4 py-3.5 sm:rounded-full sm:py-2">
            <MapPin className="h-4 w-4 shrink-0 text-neutral-400" />
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
            <Calendar className="h-4 w-4 shrink-0 text-neutral-400" />
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
            <Wallet className="h-4 w-4 shrink-0 text-neutral-400" />
            <select
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              aria-label="Budget"
              className="cursor-pointer bg-transparent text-sm outline-none"
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
            className="group col-span-2 flex cursor-pointer items-center justify-center gap-2 bg-neutral-950 px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 sm:rounded-full sm:py-3"
          >
            {content.plan}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        </motion.form>
      </div>

      {/* Scroll cue */}
      <button
        type="button"
        onClick={() => scrollTo("#about", { offset: -25, duration: 1.0 })}
        className="absolute bottom-7 left-1/2 z-20 hidden -translate-x-1/2 cursor-pointer flex-col items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60 transition-colors hover:text-white md:flex"
      >
        {content.scroll}
        <span className="relative h-8 w-px overflow-hidden bg-white/20">
          <span className="absolute inset-x-0 top-0 h-3 animate-[scroll-cue_2s_ease-in-out_infinite] bg-white" />
        </span>
      </button>

      {/* Video controls */}
      <div className="absolute bottom-6 right-6 z-30 hidden items-center gap-1 rounded-full border border-white/15 bg-black/30 px-2 py-1 text-white/70 backdrop-blur-md sm:flex">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause video" : "Play video"}
          className="cursor-pointer p-1.5 transition-colors hover:text-white"
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute video" : "Mute video"}
          className="cursor-pointer p-1.5 transition-colors hover:text-white"
        >
          {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </section>
  );
}

export default IndoTraviHero;
