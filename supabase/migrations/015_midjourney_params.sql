-- Midjourney parameters parsed from the prompt on write.
-- --p (personalization profile) and --sref (style reference) codes are
-- gallery filter dimensions; other parameters are kept for display.

alter table public.images
  add column if not exists mj_version text,
  add column if not exists mj_profiles text[],
  add column if not exists mj_srefs text[],
  add column if not exists mj_params jsonb;

create index if not exists idx_images_mj_profiles
  on public.images using gin (mj_profiles);

create index if not exists idx_images_mj_srefs
  on public.images using gin (mj_srefs);

-- Style code list for the gallery sidebar and style pages:
-- one row per code with its image count and newest image as the cover.
create or replace function public.get_midjourney_style_codes(
  p_kind text,
  p_version text default null,
  p_limit integer default 50
)
returns table (
  code text,
  count bigint,
  cover_url text,
  latest_at timestamptz
)
language sql
stable
as $$
  with codes as (
    select
      unnest(case when p_kind = 'sref' then images.mj_srefs else images.mj_profiles end) as code,
      images.url,
      images.created_at
    from public.images
    where p_kind in ('p', 'sref')
      and (p_version is null or p_version = 'all' or images.mj_version = p_version)
  )
  select
    codes.code,
    count(*)::bigint as count,
    (array_agg(codes.url order by codes.created_at desc))[1] as cover_url,
    max(codes.created_at) as latest_at
  from codes
  group by codes.code
  order by count(*) desc, max(codes.created_at) desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

grant execute on function public.get_midjourney_style_codes(text, text, integer) to anon;
grant execute on function public.get_midjourney_style_codes(text, text, integer) to authenticated;
grant execute on function public.get_midjourney_style_codes(text, text, integer) to service_role;

-- Versions present in the gallery, for the sidebar version filter.
create or replace function public.get_midjourney_versions()
returns table (
  version text,
  count bigint
)
language sql
stable
as $$
  select images.mj_version as version, count(*)::bigint as count
  from public.images
  where images.mj_version is not null
  group by images.mj_version
  order by count(*) desc;
$$;

grant execute on function public.get_midjourney_versions() to anon;
grant execute on function public.get_midjourney_versions() to authenticated;
grant execute on function public.get_midjourney_versions() to service_role;
