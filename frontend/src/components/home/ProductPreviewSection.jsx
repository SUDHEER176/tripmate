import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Map, PencilLine, Plus, Wallet } from "lucide-react";
import TripMap from "@/components/trips/TripMap";
import hanamikojiImg from "@/assets/images/places/hanamikoji.jpg";
import kenninjiImg from "@/assets/images/places/kennin-ji.jpg";
import kiyomizuImg from "@/assets/images/places/kiyomizu-dera.jpg";
import kodaijiImg from "@/assets/images/places/kodai-ji.jpg";
import maruyamaImg from "@/assets/images/places/maruyama-park.jpg";
import sannenzakaImg from "@/assets/images/places/sannenzaka.jpg";
import yasakaPagodaImg from "@/assets/images/places/yasaka-pagoda.jpg";
import yasakaShrineImg from "@/assets/images/places/yasaka-shrine.jpg";

import { cn, formatCurrency } from "@/lib/utils";
import { Reveal, SectionHeading } from "./shared";

const ease = [0.22, 1, 0.36, 1];
const BASE_TOTAL = 96400;

const stops = [
  {
    id: "kiyomizu",
    time: "08:30",
    name: "Kiyomizu-dera",
    kind: "Hillside temple · city views",
    category: "sightseeing",
    cost: 280,
    lat: 34.9949,
    lng: 135.785,
    image: kiyomizuImg,
  },
  {
    id: "sannenzaka",
    time: "10:00",
    name: "Sannenzaka & Ninenzaka",
    kind: "Old stone lanes · tea shops",
    category: "sightseeing",
    cost: 0,
    lat: 34.9967,
    lng: 135.7808,
    image: sannenzakaImg,
  },
  {
    id: "yasaka",
    time: "11:30",
    name: "Yasaka Shrine",
    kind: "Shinto shrine · Gion",
    category: "sightseeing",
    cost: 0,
    lat: 35.0036,
    lng: 135.7786,
    image: yasakaShrineImg,
  },
  {
    id: "hanamikoji",
    time: "12:30",
    name: "Lunch on Hanamikoji",
    kind: "Kaiseki & noodle spots",
    category: "food",
    cost: 1400,
    lat: 35.0026,
    lng: 135.775,
    image: hanamikojiImg,
  },
];

const nearby = [
  {
    id: "kodaiji",
    name: "Kōdai-ji",
    kind: "Zen temple & gardens",
    category: "sightseeing",
    cost: 340,
    lat: 35.0006,
    lng: 135.781,
    image: kodaijiImg,
  },
  {
    id: "yasaka-pagoda",
    name: "Yasaka Pagoda",
    kind: "Five-storey pagoda",
    category: "sightseeing",
    cost: 0,
    lat: 34.9986,
    lng: 135.7793,
    image: yasakaPagodaImg,
  },
  {
    id: "kenninji",
    name: "Kennin-ji",
    kind: "Kyoto’s oldest Zen temple",
    category: "sightseeing",
    cost: 450,
    lat: 35.0005,
    lng: 135.7736,
    image: kenninjiImg,
  },
  {
    id: "maruyama",
    name: "Maruyama Park",
    kind: "Park · autumn colours",
    category: "sightseeing",
    cost: 0,
    lat: 35.0035,
    lng: 135.781,
    image: maruyamaImg,
  },
];

const credits = [
  {
    name: "Jordy Meow",
    license: "CC BY-SA 3.0",
    href: "https://commons.wikimedia.org/wiki/File:Kiyomizu.jpg",
  },
  {
    name: "Andrea Schaffer",
    license: "CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Sannenzaka_street,_Kyoto_(3811257874).jpg",
  },
  {
    name: "Moja",
    license: "CC BY-SA 3.0",
    href: "https://commons.wikimedia.org/wiki/File:Yasaka_jinja.jpg",
  },
  {
    name: "663highland",
    license: "CC BY 2.5 / BY-SA 4.0",
    href: "https://commons.wikimedia.org/wiki/User:663highland",
  },
  {
    name: "Basile Morin",
    license: "CC BY-SA 4.0",
    href: "https://commons.wikimedia.org/wiki/File:Yasaka-dori_early_morning_with_street_lanterns_and_the_Tower_of_Yasaka_(Hokan-ji_Temple),_Kyoto,_Japan.jpg",
  },
];

const budget = [
  { label: "Stay", pct: 42, color: "bg-neutral-950" },
  { label: "Food", pct: 24, color: "bg-neutral-600" },
  { label: "Transport", pct: 14, color: "bg-neutral-400" },
  { label: "Activities", pct: 20, color: "bg-neutral-300" },
];

const features = [
  {
    icon: PencilLine,
    title: "Every stop is editable",
    body: "Change times, costs and notes, or add your own places. Nothing is locked in.",
  },
  {
    icon: Wallet,
    title: "A budget that keeps up",
    body: "Costs are split into stay, food, transport and activities, and update as you edit.",
  },
  {
    icon: Map,
    title: "Each day on a map",
    body: "Numbered pins in the order you’ll visit them, so the route makes sense on the ground.",
  },
];

// Straight-line distance in metres between two coordinates.
function distanceMetres(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function distanceFromRoute(place) {
  const metres = Math.min(...stops.map((stop) => distanceMetres(stop, place)));
  return metres < 1000
    ? `${Math.round(metres / 50) * 50} m from route`
    : `${(metres / 1000).toFixed(1)} km from route`;
}

// Inserts a place where it adds the least walking, so the route never doubles back.
function insertByDistance(route, place) {
  let bestIdx = route.length;
  let bestCost = Infinity;
  for (let i = 0; i <= route.length; i++) {
    const prev = route[i - 1];
    const next = route[i];
    const cost =
      (prev ? distanceMetres(prev, place) : 0) +
      (next ? distanceMetres(place, next) : 0) -
      (prev && next ? distanceMetres(prev, next) : 0);
    if (cost < bestCost) {
      bestCost = cost;
      bestIdx = i;
    }
  }
  return [...route.slice(0, bestIdx), place, ...route.slice(bestIdx)];
}

function toActivity(place, idx) {
  return {
    id: place.id,
    itinerary_day_id: "preview-day",
    name: place.name,
    category: place.category,
    start_time: place.time ?? null,
    location_name: null,
    lat: place.lat,
    lng: place.lng,
    estimated_cost: place.cost,
    notes: null,
    sort_order: idx,
  };
}

function StopRow({ place, index, added, active, onHover }) {
  return (
    <motion.li
      layout
      initial={added ? { opacity: 0, y: -6 } : { opacity: 0, x: -8 }}
      animate={added ? { opacity: 1, y: 0 } : undefined}
      whileInView={added ? undefined : { opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.45,
        delay: added ? 0 : 0.3 + index * 0.1,
        ease,
      }}
      onMouseEnter={() => onHover(place.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "flex cursor-default items-center gap-3 rounded-2xl p-2 transition-colors",
        active ? "bg-neutral-100" : "hover:bg-neutral-50",
      )}
    >
      <div className="relative shrink-0">
        <img
          src={place.image}
          alt=""
          loading="lazy"
          className="h-14 w-14 rounded-xl object-cover"
        />
        <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-neutral-950 text-[11px] font-medium text-white">
          {index + 1}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium text-neutral-950">
            {place.name}
          </span>
          {added && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-px text-[11px] font-medium text-emerald-700">
              Added
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {place.time && (
            <span className="tabular-nums text-neutral-400">
              {place.time} ·{" "}
            </span>
          )}
          {place.kind}
        </p>
      </div>
      <span className="shrink-0 pr-1 text-xs tabular-nums text-neutral-500">
        {place.cost ? formatCurrency(place.cost) : "Free"}
      </span>
    </motion.li>
  );
}

export function ProductPreviewSection() {
  const [addedIds, setAddedIds] = useState([]);
  const [hovered, setHovered] = useState(null);

  const addedPlaces = nearby.filter((p) => addedIds.includes(p.id));
  const dayPlaces = addedIds
    .map((id) => nearby.find((p) => p.id === id))
    .reduce(insertByDistance, stops);
  const mapStops = useMemo(() => dayPlaces.map(toActivity), [addedIds.join()]);
  const total = BASE_TOTAL + addedPlaces.reduce((sum, p) => sum + p.cost, 0);

  const toggle = (id) =>
    setAddedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );

  return (
    <section className="overflow-hidden bg-white px-5 py-24 sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Inside TripMate"
          title={
            <>
              Your whole trip,
              <br className="hidden sm:block" /> on one screen
            </>
          }
          description="Itinerary, budget and map stay in sync. Try it: add a nearby place below and watch the day update."
        />

        {/* App window */}
        <Reveal delay={0.1} y={24} className="mt-14">
          <div className="rounded-[28px] border border-neutral-200 bg-neutral-50 p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25)] sm:p-3">
            <div className="flex items-center gap-1.5 px-3 pb-3 pt-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
              <span className="ml-3 hidden rounded-md bg-white px-3 py-1 text-[11px] text-neutral-400 sm:block">
                tripmate.app/trips/kyoto-in-autumn
              </span>
            </div>

            <div className="grid gap-4 rounded-[20px] bg-white p-4 sm:p-6 lg:grid-cols-[1.15fr_1fr]">
              {/* Itinerary */}
              <div>
                <div className="flex items-end justify-between gap-4 border-b border-neutral-100 pb-4">
                  <div>
                    <p className="text-xs font-medium text-neutral-500">
                      Day 2 · Thu, 14 Nov
                    </p>
                    <p className="mt-1 font-display text-2xl tracking-tight text-neutral-950">
                      Southern Higashiyama
                    </p>
                  </div>
                  <div className="hidden gap-1 sm:flex">
                    {[1, 2, 3, 4, 5, 6].map((d) => (
                      <span
                        key={d}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium ${
                          d === 2
                            ? "bg-neutral-950 text-white"
                            : "text-neutral-400"
                        }`}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>

                <ol className="mt-3 space-y-1">
                  <AnimatePresence initial={false}>
                    {dayPlaces.map((place, idx) => (
                      <StopRow
                        key={place.id}
                        place={place}
                        index={idx}
                        added={addedIds.includes(place.id)}
                        active={hovered === place.id}
                        onHover={setHovered}
                      />
                    ))}
                  </AnimatePresence>
                </ol>
              </div>

              {/* Budget + map */}
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl border border-neutral-100 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-neutral-500">
                      Estimated total
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      Within budget
                    </span>
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={total}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15, ease }}
                      className="mt-1 font-display text-3xl tracking-tight text-neutral-950"
                    >
                      {formatCurrency(total)}
                    </motion.p>
                  </AnimatePresence>
                  <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-neutral-100">
                    {budget.map((b, idx) => (
                      <motion.span
                        key={b.label}
                        className={`h-full ${b.color}`}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${b.pct}%` }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 0.8,
                          delay: 0.5 + idx * 0.1,
                          ease,
                        }}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    {budget.map((b) => (
                      <span
                        key={b.label}
                        className="flex items-center gap-1.5 text-[11px] text-neutral-500"
                      >
                        <span className={`h-2 w-2 rounded-full ${b.color}`} />
                        {b.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-neutral-100 bg-stone-100 [&_.leaflet-container]:rounded-none [&_.trip-map]:rounded-none [&_.leaflet-control-attribution]:text-[11px]">
                  <TripMap
                    lat={35.0}
                    lng={135.78}
                    destination="Kyoto"
                    activities={mapStops}
                    activeId={hovered}
                    className="h-80"
                  />
                  <span className="pointer-events-none absolute right-3 top-3 z-[400] rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-neutral-700 shadow-sm backdrop-blur">
                    Day 2 route · {dayPlaces.length} stops
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Nearby places */}
        <div className="mt-16">
          <Reveal className="flex items-end justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium tracking-tight text-neutral-950">
                Places near your route
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Suggestions within a short walk of Day 2’s stops.
              </p>
            </div>
          </Reveal>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {nearby.map((place, idx) => {
              const isAdded = addedIds.includes(place.id);
              return (
                <Reveal key={place.id} delay={idx * 0.06}>
                  <article
                    onMouseEnter={() => isAdded && setHovered(place.id)}
                    onMouseLeave={() => setHovered(null)}
                    className={cn(
                      "group overflow-hidden rounded-3xl border bg-white transition-[border-color,box-shadow] duration-200",
                      isAdded
                        ? "border-neutral-950"
                        : "border-neutral-200 hover:border-neutral-300 hover:shadow-lg hover:shadow-neutral-950/5",
                    )}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                      <img
                        src={place.image}
                        alt={place.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-neutral-700 backdrop-blur">
                        {distanceFromRoute(place)}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="truncate font-medium text-neutral-950">
                          {place.name}
                        </h4>
                        <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                          {place.cost ? formatCurrency(place.cost) : "Free"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {place.kind}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggle(place.id)}
                        aria-pressed={isAdded}
                        className={cn(
                          "mt-4 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition-colors",
                          isAdded
                            ? "bg-neutral-950 text-white hover:bg-neutral-800"
                            : "border border-neutral-200 text-neutral-950 hover:border-neutral-950",
                        )}
                      >
                        {isAdded ? (
                          <>
                            <Check className="h-4 w-4" />
                            Added to Day 2
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Add to Day 2
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>

        {/* Feature notes */}
        <div className="mt-20 grid gap-10 sm:grid-cols-3">
          {features.map((f, idx) => (
            <Reveal key={f.title} delay={idx * 0.08}>
              <f.icon className="h-5 w-5 text-neutral-950" strokeWidth={1.75} />
              <h3 className="mt-4 text-lg font-medium tracking-tight text-neutral-950">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                {f.body}
              </p>
            </Reveal>
          ))}
        </div>

        <p className="mt-16 text-[11px] leading-relaxed text-neutral-400">
          Place photos via Wikimedia Commons:{" "}
          {credits.map((c, i) => (
            <span key={c.name}>
              <a
                href={c.href}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:text-neutral-600 hover:underline"
              >
                {c.name}
              </a>{" "}
              ({c.license}){i < credits.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

export default ProductPreviewSection;
