-- One open request per child, and sensible limits on what a request holds.
-- "Open" = pending, matched or accepted. (A declined request is re-matched
-- by an admin, so it never needs a second request.)

CREATE UNIQUE INDEX IF NOT EXISTS uniq_requests_one_open_per_child
  ON public.requests (child_id)
  WHERE status IN ('pending', 'matched', 'accepted');

ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_notes_length;
ALTER TABLE public.requests
  ADD CONSTRAINT requests_notes_length CHECK (notes IS NULL OR char_length(notes) <= 500) NOT VALID;

ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_needs_not_empty;
ALTER TABLE public.requests
  ADD CONSTRAINT requests_needs_not_empty CHECK (cardinality(needs) > 0) NOT VALID;
