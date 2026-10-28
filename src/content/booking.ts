// The booking link, in one place.
//
// It lives here rather than in the two contact pages because the pages are not
// the only thing that has to agree with it: both privacy pages name Calendly as
// a processor, and they are only allowed to do that while this is set. The
// Romanian page once carried a button pointing at calendly.com itself, the
// company home page, which is what happens when a URL is typed twice.
//
// Empty string means no booking: the button disappears from both contact pages
// and Calendly drops out of both privacy pages, together, in one edit.
export const BOOKING_URL = 'https://calendly.com/quickflow-dev/30min';

/** Whether anything on the site should mention booking at all. */
export const BOOKING = BOOKING_URL.length > 0;
