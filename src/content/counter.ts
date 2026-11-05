// Whether the server-side page view counter runs (functions/_middleware.ts).
//
// Both privacy pages read this and describe the counter only while it is true.
// It is a constant rather than an environment variable because the counter is
// code in this repository: it ships with every deployment. What can still make
// it silent is the PAGEVIEWS binding in the Pages project settings. If that
// binding is ever removed for good, set this to false in the same change, so
// the pages stop describing a count that no longer happens. See ADR-0006.
export const PAGE_COUNTER = true;
