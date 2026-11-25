import { useState } from "react";
import { Check, Copy, Link2, Loader2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { shareTrip, shareUrl, sharingAvailable, unshareTrip } from "@/lib/api";

/** "Share" button and dialog: turn on a read-only link, copy it, send it, or turn it off. */
export function ShareTripButton({ trip, onShareChange }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const shareId = trip.share_id;
  const url = shareId ? shareUrl(shareId) : "";
  const message = `My ${trip.destination} trip plan on TripMate: ${url}`;

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      onShareChange(await shareTrip(trip.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the link.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!window.confirm("Turn off this link? Anyone who has it will no longer see the trip.")) return;
    setBusy(true);
    setError(null);
    try {
      await unshareTrip(trip.id);
      onShareChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not turn off the link.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed. Select the link and copy it yourself.");
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
      >
        <Share2 className="h-3.5 w-3.5" />
        Share
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
            className="w-full max-w-md rounded-b-none p-6 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="share-title" className="text-lg font-semibold text-neutral-950">
                  Share this trip
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Anyone with the link can view the itinerary. They can't edit it, and your
                  notes, expenses and packing list stay private.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="cursor-pointer rounded-full p-1 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!sharingAvailable ? (
              <p className="mt-5 rounded-xl bg-neutral-100 p-3 text-sm text-neutral-600">
                Sharing needs an account. Demo trips are saved only in this browser.
              </p>
            ) : shareId ? (
              <div className="mt-5 space-y-3">
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={url}
                    aria-label="Share link"
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 outline-none"
                  />
                  <Button onClick={copy} className="shrink-0">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">Send on WhatsApp</Button>
                  </a>
                  {typeof navigator.share === "function" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigator.share({ title: trip.title, text: message, url }).catch(() => {})
                      }
                    >
                      More options
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={disable}
                    disabled={busy}
                    className="ml-auto text-terracotta"
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Stop sharing
                  </Button>
                </div>
              </div>
            ) : (
              <Button className="mt-5 w-full" onClick={enable} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Create share link
              </Button>
            )}

            {error && (
              <p role="alert" className="mt-3 text-sm text-terracotta">
                {error}
              </p>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
