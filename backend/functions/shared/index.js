// API: shared (public, no sign-in)
//
// GET /api/shared/:shareId   read-only view of a trip whose owner turned on
//                            its share link (POST /api/trips/:id/share).
// Only trip-planning details are returned; see publicTripView().

import { serveJson } from "../_shared/handler.js";
import { ApiError, ok } from "../_shared/http.js";
import { getSharedTrip, publicTripView } from "../_shared/trips-repo.js";

const SHARE_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function parseShareId(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  const base = segments.lastIndexOf("shared");
  const rest = base === -1 ? [] : segments.slice(base + 1);
  if (rest.length !== 1 || !SHARE_ID_RE.test(rest[0])) {
    throw new ApiError(404, "SHARE_NOT_FOUND", "This share link is invalid or has been turned off.");
  }
  return rest[0];
}

export default serveJson(["GET"], async (req) => {
  const shareId = parseShareId(new URL(req.url).pathname);
  return ok(publicTripView(await getSharedTrip(shareId)));
});
