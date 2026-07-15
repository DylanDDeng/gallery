-- Run only after the dimension backfill verifier reports no missing/partial
-- dimensions and confirms every stored value against the source metadata.
alter table public.images
  validate constraint images_dimensions_paired_positive_check;

alter table public.images
  alter column width drop default,
  alter column height drop default,
  alter column width set not null,
  alter column height set not null;

