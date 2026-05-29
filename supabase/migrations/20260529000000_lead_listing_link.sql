-- ============================================================
-- Link leads to the internal property catalog.
-- listing_ref (text) stays for external listings (portal URLs the agent extracts).
-- listing_id (uuid FK) is the internal pointer to public.properties.
-- ============================================================

alter table public.leads
  add column if not exists listing_id uuid references public.properties(id) on delete set null;

create index if not exists leads_listing_id_idx
  on public.leads (listing_id) where listing_id is not null;
