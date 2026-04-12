-- Add workflow status to annotations for agency review flow.
-- Client submits notes → agency reviews → marks each as
-- in_progress / updated / completed / declined.

alter table public.annotations
  add column if not exists status text not null default 'pending',
  add column if not exists agency_reply text,
  add column if not exists agency_reply_by text,
  add column if not exists agency_reply_at timestamptz,
  add column if not exists updated_at timestamptz default now();

comment on column public.annotations.status is
  'Workflow: pending → in_progress → updated → completed | declined';
comment on column public.annotations.agency_reply is
  'Agency response to the client annotation';
