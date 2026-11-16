-- ============================================================
-- KALLETA — Update 42
--  1. Analyseseite: Zugang nur für hinterlegte E-Mail-Adressen.
--  2. Systemzahlen für die Analyseseite (Datenbankgröße, Tabellen,
--     Konten, Verbrauch von Supabase und Cloudflare).
-- Einmal im Supabase-SQL-Editor ausführen (nach Update 41).
--
-- WICHTIG: Unten in der letzten Zeile deine E-Mail-Adresse eintragen
-- (die, mit der du dich in Kalleta anmeldest), dann ausführen.
-- ============================================================

-- Wer die Analyseseite sehen darf.
create table if not exists public.analyse_zugang (
  email text primary key
);
alter table public.analyse_zugang enable row level security;
-- Keine Policies: niemand kann die Liste über die App lesen oder ändern,
-- nur im Supabase-Dashboard (Table Editor oder SQL Editor).

-- Ist die angemeldete Person freigeschaltet? (bestätigte E-Mail nötig)
create or replace function public.analyse_erlaubt()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.users u
    join public.analyse_zugang z on lower(trim(z.email)) = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.analyse_erlaubt() from public;
grant execute on function public.analyse_erlaubt() to authenticated;

-- Statistik lesen: jetzt nach E-Mail statt nach Inhaber-Rolle.
create or replace function public.nutzung_lesen(p_von date, p_bis date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  von date := coalesce(p_von, (now() at time zone 'Europe/Berlin')::date - 29);
  bis date := coalesce(p_bis, (now() at time zone 'Europe/Berlin')::date);
begin
  if not public.analyse_erlaubt() then
    raise exception 'N-01: kein Zugang';
  end if;
  if bis - von > 400 then von := bis - 400; end if;
  return jsonb_build_object(
    'von', von, 'bis', bis,
    'zaehler', coalesce((select jsonb_agg(jsonb_build_array(tag, schluessel, anzahl) order by tag)
                         from public.nutzung where tag between von and bis), '[]'::jsonb),
    'konten', (select count(*) from public.profiles),
    'konten_neu', coalesce((select jsonb_agg(jsonb_build_array(d, n) order by d) from (
                   select (created at time zone 'Europe/Berlin')::date d, count(*) n from public.profiles
                   where (created at time zone 'Europe/Berlin')::date between von and bis group by 1) x), '[]'::jsonb),
    'ereignisse', (select count(*) from public.events),
    'ereignisse_neu', coalesce((select jsonb_agg(jsonb_build_array(d, n) order by d) from (
                   select (created at time zone 'Europe/Berlin')::date d, count(*) n from public.events
                   where (created at time zone 'Europe/Berlin')::date between von and bis group by 1) x), '[]'::jsonb),
    'aktiv_30', (select count(distinct owner) from public.events where changed > now() - interval '30 days')
  );
end; $$;

-- Systemzahlen: Größe, Tabellen, Konten, Verbrauch.
create or replace function public.analyse_system()
returns jsonb language plpgsql stable security definer set search_path = public, auth, pg_catalog as $$
declare
  r jsonb := '{}'::jsonb;
  x jsonb;
begin
  if not public.analyse_erlaubt() then
    raise exception 'N-01: kein Zugang';
  end if;

  r := r || jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'heute', (now() at time zone 'Europe/Berlin')::date,
    'postgres', current_setting('server_version'));

  -- Größte Tabellen (alle Schemas außer System).
  r := r || jsonb_build_object('tabellen', coalesce((
    select jsonb_agg(jsonb_build_array(name, bytes, zeilen) order by bytes desc) from (
      select n.nspname || '.' || c.relname as name, pg_total_relation_size(c.oid) as bytes, greatest(c.reltuples, 0)::bigint as zeilen
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r' and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
      order by pg_total_relation_size(c.oid) desc limit 12) t), '[]'::jsonb));

  -- Konten (Supabase Auth).
  r := r || jsonb_build_object('auth', jsonb_build_object(
    'gesamt', (select count(*) from auth.users),
    'bestaetigt', (select count(*) from auth.users where email_confirmed_at is not null),
    'aktiv_30', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'aktiv_7', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days')));

  -- Verbrauch, wie ihn die App mitzählt (usage_day / usage_month / storage_state).
  begin
    r := r || jsonb_build_object(
      'tag', (select to_jsonb(d) from public.usage_day d where d.day = current_date),
      'monat', (select to_jsonb(m) from public.usage_month m where m.ym = to_char(now(), 'YYYY-MM')),
      'tage', coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from public.usage_day d where d.day > current_date - 30), '[]'::jsonb),
      'r2_bytes', (select bytes from public.storage_state where id = 1),
      'monat_ende', (date_trunc('month', now()) + interval '1 month')::date);
  exception when others then null;
  end;

  -- Supabase Storage (falls genutzt).
  begin
    select jsonb_build_object('bytes', coalesce(sum((metadata->>'size')::bigint), 0), 'dateien', count(*))
      into x from storage.objects;
    r := r || jsonb_build_object('supabase_storage', x);
  exception when others then null;
  end;

  -- KI-Aufrufe heute (falls die Funktion existiert).
  begin
    execute 'select to_jsonb(public.ai_today())' into x;
    r := r || jsonb_build_object('ki_heute', x);
  exception when others then null;
  end;

  return r;
end; $$;
revoke all on function public.analyse_system() from public;
grant execute on function public.analyse_system() to authenticated;

-- >>> Hier deine E-Mail-Adresse eintragen (weitere Adressen: Zeile kopieren) <<<
insert into public.analyse_zugang (email) values ('DEINE-MAIL@beispiel.de') on conflict do nothing;
