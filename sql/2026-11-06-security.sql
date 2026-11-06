-- MascotGen security fixes, 6 Nov 2026
-- Run ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once.

-- 1) One plan, one wallet. The first wallet that opens a pack on a plan is
--    bound to it; later packs on that plan must come from the same wallet.
alter table subscribers add column if not exists bound_wallet text;

-- 2) Pack rolls are looked up by the NFT they were spent on — keep it fast.
create index if not exists pending_mints_mint_address_idx on pending_mints (mint_address);

-- 3) A pack roll can only ever be spent on ONE NFT. Only created if the
--    existing data is already clean, so this script can never fail halfway.
do $$
begin
  if not exists (
    select mint_address from pending_mints
    where mint_address is not null
    group by mint_address having count(*) > 1
  ) then
    create unique index if not exists pending_mints_one_nft_per_roll
      on pending_mints (mint_address) where mint_address is not null;
  else
    raise notice 'Skipped unique index: duplicate mint_address rows exist in pending_mints. Send this message to Claude.';
  end if;
end $$;
