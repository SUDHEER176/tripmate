import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Sparkles, X } from "lucide-react";
import { searchPlaces, type PlaceSuggestion } from "@/lib/places";
import { cn } from "@/lib/utils";

interface DestinationAutocompleteProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSelectPlace?: (place: PlaceSuggestion) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
}

export function DestinationAutocomplete({
  id = "destination-autocomplete",
  value,
  onChange,
  onSelectPlace,
  placeholder = "Kyoto, Lisbon, Konaseema…",
  required,
  className,
  inputClassName,
  autoFocus,
}: DestinationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchPlaces(value, controller.signal);
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setHighlightedIndex(-1);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(suggestion: PlaceSuggestion) {
    onChange(suggestion.name);
    if (onSelectPlace) {
      onSelectPlace(suggestion);
    }
    setIsOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === "Enter" && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      e.preventDefault();
      handleSelect(suggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          autoComplete="off"
          className={cn(
            "h-12 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-10 text-base shadow-xs outline-none transition placeholder:text-neutral-400 hover:border-neutral-300 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5",
            inputClassName,
          )}
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
          {value && !loading && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setSuggestions([]);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="rounded-full p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Clear destination"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-neutral-200/80 bg-white p-1.5 shadow-xl shadow-black/10 backdrop-blur-md"
        >
          {suggestions.map((item, index) => {
            const isHighlighted = index === highlightedIndex;
            return (
              <li
                key={item.id}
                role="option"
                aria-selected={isHighlighted}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => handleSelect(item)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors",
                  isHighlighted ? "bg-neutral-100 text-neutral-950" : "text-neutral-700 hover:bg-neutral-50",
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      item.isCurated ? "bg-terracotta/10 text-terracotta" : "bg-neutral-100 text-neutral-600",
                    )}
                  >
                    {item.isCurated ? <Sparkles className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">{item.name}</p>
                    <p className="truncate text-xs text-neutral-500">{item.subtitle}</p>
                  </div>
                </div>

                {item.isCurated && (
                  <span className="shrink-0 rounded-full bg-terracotta/10 px-2 py-0.5 text-[10px] font-semibold text-terracotta">
                    Popular
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
