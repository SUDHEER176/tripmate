import { useState, useMemo } from "react";
import { ArrowRight, Compass, MapPin, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { destinations, interestOptions } from "@/lib/destinations";
import { formatCurrency } from "@/lib/utils";

export function ExplorePage() {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");

  const filtered = useMemo(() => {
    return destinations.filter((dest) => {
      const matchesSearch =
        dest.name.toLowerCase().includes(search.toLowerCase()) ||
        dest.country.toLowerCase().includes(search.toLowerCase()) ||
        dest.blurb.toLowerCase().includes(search.toLowerCase());

      const matchesTag =
        selectedTag === "all" || dest.tags.includes(selectedTag);

      return matchesSearch && matchesTag;
    });
  }, [search, selectedTag]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1 text-xs font-semibold text-pine">
            <Compass className="h-3.5 w-3.5" />
            Curated World Destinations
          </div>
          <h1 className="mt-2 font-display text-3xl text-forest sm:text-4xl">
            Explore places to visit
          </h1>
          <p className="mt-1 text-sm text-forest/70">
            Browse our handpicked spots, review average daily costs, and spin up an AI itinerary.
          </p>
        </div>

        <Link to="/plan-trip">
          <Button className="shrink-0">
            <Sparkles className="h-4 w-4" />
            Plan custom destination
          </Button>
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="mt-8 flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-forest/40" />
          <Input
            placeholder="Search by city, country, or vibe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tag Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedTag("all")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              selectedTag === "all"
                ? "bg-forest text-sand"
                : "bg-sand/70 text-forest/80 hover:bg-sand"
            }`}
          >
            All Destinations
          </button>
          {interestOptions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => setSelectedTag(tag.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                selectedTag === tag.id
                  ? "bg-forest text-sand"
                  : "bg-sand/70 text-forest/80 hover:bg-sand"
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* Destinations Grid */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((dest) => (
          <Card
            key={dest.name}
            className="group flex flex-col overflow-hidden border-forest/10 transition-all hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="relative h-52 w-full overflow-hidden">
              <img
                src={dest.image}
                alt={dest.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute top-3 left-3 rounded-full bg-paper/90 px-2.5 py-1 text-xs font-medium text-forest backdrop-blur">
                {dest.vibe}
              </div>
              <div className="absolute bottom-3 left-3 text-white">
                <h3 className="font-display text-2xl leading-none">{dest.name}</h3>
                <p className="mt-1 flex items-center gap-1 text-xs text-white/90">
                  <MapPin className="h-3 w-3" />
                  {dest.country}
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-between p-5">
              <div>
                <p className="text-sm text-forest/75">{dest.blurb}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {dest.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-sand px-2 py-0.5 text-[11px] font-medium text-forest/80"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-forest/10 pt-4">
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-forest/50">
                    Est. Daily
                  </span>
                  <span className="font-semibold text-pine">
                    {formatCurrency(dest.avgDaily)}
                  </span>
                </div>
                <Link to={`/plan-trip?destination=${encodeURIComponent(dest.name)}`}>
                  <Button size="sm">
                    Plan trip
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-16 rounded-3xl border border-dashed border-forest/20 p-12 text-center">
          <Compass className="mx-auto h-10 w-10 text-forest/40" />
          <h3 className="mt-3 font-display text-lg text-forest">No destinations found</h3>
          <p className="mt-1 text-sm text-forest/60">
            No locations matched your filter query "{search}". Try searching for something else or plan any custom destination!
          </p>
          <div className="mt-5">
            <Link to="/plan-trip">
              <Button>Plan custom trip anyway</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
