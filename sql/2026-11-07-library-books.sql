-- MascotGen "Library as a book", 7 Nov 2026
-- Run ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once: every step is "if not exists" / "where not set".
--
-- What this does, in plain words:
--   * A BOOK is a shelf item (title + cover). A book has SEASONS. A season has
--     CHAPTERS in order. Every published chapter now belongs to one book, one
--     season, one position.
--   * Your existing chapters are sorted into books automatically: every saga
--     name you used becomes a book, and every character with solo chapters gets
--     its own book. Everything lands in Season 1 and is renumbered 1, 2, 3…
--     in the order it was already in (old chapter number, then publish date).

-- 1) The two new tables.
create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  owner_wallet text,
  official boolean not null default false,
  cover_mint text,
  created_at timestamptz not null default now()
);

create table if not exists book_seasons (
  book_id uuid not null references books(id) on delete cascade,
  season_no int not null,
  title text,
  blurb text,
  primary key (book_id, season_no)
);

-- 2) Chapters learn which book + season they belong to.
alter table published_chapters add column if not exists book_id uuid references books(id);
alter table published_chapters add column if not exists season_no int default 1;
create index if not exists published_chapters_book_idx on published_chapters (book_id, season_no, chapter_no);
create index if not exists books_owner_idx on books (owner_wallet);

-- 3) THE OFFICIAL BOOK. "Something Is Climbing" is the main saga.
--    ⚠️ XAVIER: owner_wallet is left NULL on purpose. Paste your studio wallet
--    (the first address in DEV_WALLETS on Vercel) into the UPDATE at the very
--    bottom of this file and run it. Until then only DEV_WALLETS can add to it
--    (the server allows DEV_WALLETS on every official book anyway).
insert into books (slug, title, owner_wallet, official)
values ('something-is-climbing', 'Something Is Climbing', null, true)
on conflict (slug) do nothing;

-- 4) MIGRATE EXISTING CHAPTERS INTO BOOKS. Only touches rows with no book yet.
do $$
declare
  official_id uuid;
begin
  select id into official_id from books where slug = 'something-is-climbing';

  -- 4a) Chapters published under the official saga name join the official book.
  update published_chapters
     set book_id = official_id, season_no = coalesce(season_no, 1)
   where book_id is null
     and arc_name is not null
     and lower(trim(arc_name)) = 'something is climbing';

  -- 4b) Named sagas (arc_name differs from the character's name): one book per
  --     (wallet, arc_name). Slug = the name, plus a short hash so two authors
  --     can both have a book called "Origins".
  insert into books (slug, title, owner_wallet, cover_mint, official)
  select distinct on (c.wallet, lower(trim(c.arc_name)))
         trim(both '-' from regexp_replace(lower(c.arc_name), '[^a-z0-9]+', '-', 'g'))
           || '-' || left(md5(c.wallet || '|' || lower(trim(c.arc_name))), 6)       as slug,
         left(trim(c.arc_name), 80)                                                  as title,
         c.wallet                                                                    as owner_wallet,
         c.mint_address                                                              as cover_mint,
         false
    from published_chapters c
   where c.book_id is null
     and c.arc_name is not null
     and trim(c.arc_name) <> ''
     and lower(trim(c.arc_name)) <> lower(trim(coalesce(c.character_name, '')))
   order by c.wallet, lower(trim(c.arc_name)), c.chapter_no nulls last, c.published_at
  on conflict (slug) do nothing;

  update published_chapters c
     set book_id = b.id, season_no = coalesce(c.season_no, 1)
    from books b
   where c.book_id is null
     and c.arc_name is not null
     and trim(c.arc_name) <> ''
     and lower(trim(c.arc_name)) <> lower(trim(coalesce(c.character_name, '')))
     and b.owner_wallet = c.wallet
     and b.slug = trim(both '-' from regexp_replace(lower(c.arc_name), '[^a-z0-9]+', '-', 'g'))
                  || '-' || left(md5(c.wallet || '|' || lower(trim(c.arc_name))), 6);

  -- 4c) Solo chapters (no saga, or saga = the character): one book per mascot,
  --     keyed by mint_address. Slug = character name + first 6 of the mint —
  --     the SAME formula api/battle.js uses, so new solo publishes find it.
  insert into books (slug, title, owner_wallet, cover_mint, official)
  select distinct on (c.mint_address)
         trim(both '-' from regexp_replace(lower(coalesce(nullif(trim(c.arc_name), ''), c.character_name, 'untitled')), '[^a-z0-9]+', '-', 'g'))
           || '-' || left(c.mint_address, 6)                                         as slug,
         left(coalesce(nullif(trim(c.arc_name), ''), c.character_name, 'Untitled'), 80) as title,
         c.wallet,
         c.mint_address,
         false
    from published_chapters c
   where c.book_id is null
     and c.mint_address is not null
   order by c.mint_address, c.chapter_no nulls last, c.published_at
  on conflict (slug) do nothing;

  update published_chapters c
     set book_id = b.id, season_no = coalesce(c.season_no, 1)
    from books b
   where c.book_id is null
     and c.mint_address is not null
     and b.cover_mint = c.mint_address
     and b.official = false
     and b.slug = trim(both '-' from regexp_replace(lower(coalesce(nullif(trim(c.arc_name), ''), c.character_name, 'untitled')), '[^a-z0-9]+', '-', 'g'))
                  || '-' || left(c.mint_address, 6);

  -- 4d) Every book gets a Season 1 row.
  insert into book_seasons (book_id, season_no, title)
  select distinct book_id, coalesce(season_no, 1), 'Season ' || coalesce(season_no, 1)
    from published_chapters
   where book_id is not null
  on conflict (book_id, season_no) do nothing;

  -- 4e) Renumber: inside each (book, season) chapters become 1, 2, 3… in the
  --     order they already had (old number first, then publish date). Running
  --     this again changes nothing once the numbers are dense.
  with ranked as (
    select id,
           row_number() over (partition by book_id, season_no
                              order by chapter_no nulls last, published_at, id) as rn
      from published_chapters
     where book_id is not null
  )
  update published_chapters p
     set chapter_no = r.rn
    from ranked r
   where p.id = r.id
     and p.chapter_no is distinct from r.rn;

  raise notice 'Library books migration done.';
end $$;

-- 5) ⚠️ XAVIER — SET THE OFFICIAL BOOK'S OWNER. Replace the address below with
--    your studio wallet (first entry of DEV_WALLETS in Vercel), remove the two
--    dashes at the start of the line, and run it:
-- update books set owner_wallet = 'PASTE_YOUR_STUDIO_WALLET_HERE' where slug = 'something-is-climbing';
