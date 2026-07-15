-- Image dimensions are discovered by the server from the immutable source
-- object. They must never inherit a made-up aspect ratio from a column default.
alter table public.images
  alter column width drop default,
  alter column height drop default;

alter table public.images
  drop constraint if exists images_dimensions_paired_positive_check;

alter table public.images
  add constraint images_dimensions_paired_positive_check
  check (
    (width is null and height is null)
    or (
      width is not null
      and height is not null
      and width > 0
      and height > 0
    )
  ) not valid;

