create index if not exists koto_system_logs_created_idx on koto_system_logs(created_at desc);
create index if not exists koto_system_logs_level_service_idx on koto_system_logs(level, service, created_at desc);
alter table profiles add column if not exists onboarding_completed boolean default false;
