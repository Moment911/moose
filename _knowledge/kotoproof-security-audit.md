# KotoProof — Security & RLS Audit

**Date:** 2026-04-17
**Scope:** `/review/:token` public surface, `/api/proof/verify-token`, `projects` / `files` / `annotations` / `activity_log` / `revision_rounds` / `project_access` / `signatures`.

This document captures the current security posture of KotoProof after
the 2026-04-17 hardening pass. It names what's safe, what still needs
work, and ships recommended RLS policies as ready-to-review SQL — not
auto-applied, because RLS regression bugs break the app and need to be
verified against real agency data first.

---

## What was fixed on 2026-04-17

### 1. `access_password` no longer leaks to the browser

**Before:** `PublicReviewPage.loadFileByToken` ran
`supabase.from('files').select('*, projects(*, clients(*))')` with the
anon key. The response included `projects.access_password` in plaintext
for every password-gated project. The password comparison then ran in the
browser (`if (password === project.access_password)`) — so anyone opening
devtools could see the password before they typed it.

**Now:** Both the initial lookup and the password submission go through
`POST /api/proof/verify-token`. That route uses the service-role key
server-side, does the password comparison server-side, and strips
`access_password` from the response payload. The password never enters
the browser.

**Files touched:**
- `src/app/api/proof/verify-token/route.ts` (new)
- `src/views/PublicReviewPage.jsx` (refactored `loadFileByToken` + `handlePasswordSubmit`)

### 2. Private projects no longer leak file URLs

**Before:** `setFile(fileData); setProject(proj)` ran *before* the
`access_level === 'private'` check. The signed Supabase storage URL was
already in React state and fetched by the browser by the time the UI
flipped to `status: 'denied'`. Clever clients could extract the URL
from component state.

**Now:** The server route returns `403 forbidden` for private projects
without ever returning the file row. React state stays empty. The
`denied` screen renders from a clean slate.

---

## What still needs work (in priority order)

### 3. No RLS on `projects`, `files`, or `annotations`

The anon key can currently read any row in these tables. The app relies
on frontend filtering (`clients.agency_id === agencyId`) to hide other
agencies' data. Any attacker who opens the JS bundle can bypass this
with a direct Supabase call.

**Risk:** cross-agency data read. An agency admin who knows the endpoint
can list every proof project across every agency on the platform.

**Impact:** medium-to-high. The app has been shipping without RLS since
launch; no evidence of abuse, but the exposure is real.

**Fix:** apply the policies in the Recommended RLS section below. These
are designed to preserve the current app behavior while blocking
cross-agency reads at the database layer.

### 4. Public-token enumeration is possible

`public_token` is a 16-character nanoid. That's 95 bits of entropy —
effectively unguessable. BUT there's no rate-limit on
`/api/proof/verify-token`. A determined attacker could hit it at
1000+ requests/second and eventually enumerate valid tokens for
public or password-gated projects.

**Fix options:**
- Add a simple IP-based rate limit (e.g. Vercel KV + sliding window)
- Add an exponential backoff after N failures per IP
- Log repeated 404s to `koto_security_events` and alert on spikes

### 5. Password-gated `access_password` is stored as plaintext in the DB

`projects.access_password` is a `text` column with no hashing. If the
DB is compromised (backup leak, service-role key leak), every proof
password is exposed in plaintext.

**Fix:**
- Store `bcrypt(password)` instead of the plaintext
- Update `/api/proof/verify-token` to call `bcrypt.compare`
- Migrate existing passwords on first-submit (re-hash if they look
  like plaintext rather than a $2b$ hash)

### 6. Files can be replaced mid-round; annotation orphan behavior undocumented

If a team member re-uploads a file to the same `files.id`, existing
annotations point at the old visual content. Currently this is not
surfaced in the UI — the annotations just float on the new canvas,
usually in the wrong position.

**Fix:** either freeze annotations to a specific file version
(`annotations.file_version_id`) or warn the re-uploader that
annotations will be invalidated.

### 7. Signed Storage URLs never expire

Current storage bucket is `review-files` with public access. Anyone
who has ever loaded a file URL has it forever. If a client leaks the
URL, there's no way to revoke.

**Fix:** switch to private bucket + signed URLs with a short TTL
issued by `/api/proof/sign-file` every time a reviewer loads a file.

---

## Recommended RLS policies — review before applying

Paste this into a migration file **after testing on staging**. It
assumes:

- `agencies.id` is the tenant root
- `users.agency_id` is set correctly on every authenticated user
- `projects.client_id → clients.id → clients.agency_id` is the
  authoritative ownership path
- The `auth.jwt()` helper is available (standard in Supabase)

```sql
-- ── KotoProof RLS hardening ───────────────────────────────────────────────
-- Wraps projects + files + annotations + activity_log + revision_rounds
-- so anon + authenticated users can only read rows that belong to their
-- agency OR are accessed via the public /review/:token surface.

-- projects
alter table projects enable row level security;

drop policy if exists "projects_agency_read" on projects;
create policy "projects_agency_read"
  on projects for select
  using (
    -- Signed-in staff: must belong to the project's client's agency
    exists (
      select 1
      from clients c
      where c.id = projects.client_id
        and c.agency_id = (auth.jwt() ->> 'agency_id')::uuid
    )
  );

drop policy if exists "projects_agency_write" on projects;
create policy "projects_agency_write"
  on projects for all
  using (
    exists (
      select 1
      from clients c
      where c.id = projects.client_id
        and c.agency_id = (auth.jwt() ->> 'agency_id')::uuid
    )
  )
  with check (
    exists (
      select 1
      from clients c
      where c.id = projects.client_id
        and c.agency_id = (auth.jwt() ->> 'agency_id')::uuid
    )
  );

-- files
alter table files enable row level security;

drop policy if exists "files_agency_read" on files;
create policy "files_agency_read"
  on files for select
  using (
    exists (
      select 1
      from projects p
      join clients c on c.id = p.client_id
      where p.id = files.project_id
        and c.agency_id = (auth.jwt() ->> 'agency_id')::uuid
    )
  );

-- Anon public-token read — only when the project is not private.
-- This replaces the anon's blanket select and is what makes the
-- /review/:token API route return real data.
drop policy if exists "files_public_token_read" on files;
create policy "files_public_token_read"
  on files for select
  to anon
  using (
    exists (
      select 1
      from projects p
      where p.id = files.project_id
        and p.access_level in ('public', 'password')
        and p.public_token is not null
    )
  );

-- annotations + annotation_replies — mirror files
alter table annotations enable row level security;

drop policy if exists "annotations_agency_read" on annotations;
create policy "annotations_agency_read"
  on annotations for select
  using (
    exists (
      select 1
      from files f
      join projects p on p.id = f.project_id
      join clients c on c.id = p.client_id
      where f.id = annotations.file_id
        and c.agency_id = (auth.jwt() ->> 'agency_id')::uuid
    )
  );

drop policy if exists "annotations_public_read" on annotations;
create policy "annotations_public_read"
  on annotations for select
  to anon
  using (
    exists (
      select 1
      from files f
      join projects p on p.id = f.project_id
      where f.id = annotations.file_id
        and p.access_level in ('public', 'password')
    )
  );

-- Anon writes annotations (this is the point of public review) —
-- only on files whose project is public/password-gated.
drop policy if exists "annotations_public_write" on annotations;
create policy "annotations_public_write"
  on annotations for insert
  to anon
  with check (
    exists (
      select 1
      from files f
      join projects p on p.id = f.project_id
      where f.id = file_id
        and p.access_level in ('public', 'password')
    )
  );

-- Same pattern for annotation_replies, revision_rounds, activity_log.
-- Copy the two templates above and swap the join condition.
```

---

## Test plan before applying RLS

Run these with a non-admin agency account, then repeat with the anon
key to simulate a public review. Any row that comes back SHOULD be
one you expect; any row that doesn't is a false negative that will
break the app.

1. **Own agency — visible**
   ```sql
   select id, name from projects where client_id in (
     select id from clients where agency_id = '<your-agency-id>'
   );
   ```
   Must return your projects.

2. **Cross-agency — hidden**
   ```sql
   select id, name from projects where client_id in (
     select id from clients where agency_id != '<your-agency-id>'
   );
   ```
   Must return 0 rows.

3. **Anon with valid public token — visible**
   ```js
   // run from browser console on /review/<valid-public-token>
   const { data } = await supabase
     .from('files')
     .select('id, name')
     .eq('public_token', '<valid-public-token>')
   // should return the one file
   ```

4. **Anon with fabricated token — hidden**
   ```js
   const { data } = await supabase
     .from('files')
     .select('id, name')
     .eq('public_token', 'garbage-token')
   // should return []
   ```

5. **Anon enumerating by project_id — hidden**
   ```js
   const { data } = await supabase
     .from('files')
     .select('id, name')
     .eq('project_id', '<someone-elses-project-id>')
   // should return 0 rows because the project isn't public/password
   ```

If any of those tests fail, DO NOT deploy the RLS migration — stage it
and iterate on the policies instead.

---

## Long-tail recommendations (nice-to-haves, not blockers)

- Add a `koto_security_events` table and log every 4xx/5xx from
  `/api/proof/verify-token`. Alert when a single IP produces >100
  `not_found` responses in an hour.
- Add `password_expires_at` on projects — let agencies rotate
  review passwords without re-issuing links.
- Add `signed_url_policy` on the storage bucket so every file URL
  has a 24-hour TTL by default.
- Build a `/admin/proof-access-log` page showing which tokens have
  been accessed, from what country/IP, and when.
- Invalidate all annotations when a file is replaced, or version
  them against `files.current_version_id`.

---

**Owner:** Whoever touches KotoProof next. Keep this doc current with
every new surface the public review gets.
