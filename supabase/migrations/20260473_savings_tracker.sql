-- koto_savings — editable rows powering the "Savings vs Alternatives" card
-- on /cog-report. Replaces the old hardcoded SAVINGS const. Each row
-- represents one Koto feature compared against the paid alternative it
-- displaces, with a user-set monthly dollar savings estimate.

create table if not exists public.koto_savings (
  id               uuid primary key default gen_random_uuid(),
  label            text not null,
  using_tool       text not null,
  instead_of       text not null,
  monthly_savings  numeric(10,2) not null default 0,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists koto_savings_sort_idx on public.koto_savings (sort_order, created_at);

alter table public.koto_savings enable row level security;

drop policy if exists "savings read" on public.koto_savings;
create policy "savings read"  on public.koto_savings for select using (true);
drop policy if exists "savings write" on public.koto_savings;
create policy "savings write" on public.koto_savings for all    using (true) with check (true);

-- Seed with the 5 rows that were previously hardcoded in CogReportPage.jsx,
-- so the card looks identical on first load. User can edit/delete/add after.
insert into public.koto_savings (label, using_tool, instead_of, monthly_savings, sort_order)
select * from (values
  ('Obsidian vs Notion AI',              'Obsidian + Copilot',  'Notion AI',                        20,   10),
  ('Koto voice onboarding vs Calendly + VA', 'Retell + Koto',    'Calendly + virtual assistant',    300,  20),
  ('Koto proposals vs Proposify',        'Claude API',          'Proposify',                        49,   30),
  ('Koto proof review vs Filestage',     'Koto built-in',       'Filestage',                        49,   40),
  ('Koto discovery vs strategy consult', 'Claude API',          'Strategy consultant /session',    500,   50)
) as seed(label, using_tool, instead_of, monthly_savings, sort_order)
where not exists (select 1 from public.koto_savings);
