-- ============================================================
-- KALLETA — Update 41
--  Anonyme Nutzungsstatistik (nur mit Zustimmung im Cookie-Fenster).
--  · Gespeichert werden nur Zähler pro Tag (z. B. "aufruf" = 37),
--    keine IP-Adressen, keine Konten, keine Geräte-Kennungen.
--  · Lesen darf nur der Inhaber (profiles.role = 'owner').
--  · Daten älter als 400 Tage werden beim Schreiben gelöscht.
-- Einmal im Supabase-SQL-Editor ausführen (nach Update 40).
-- ============================================================

create table if not exists public.nutzung (
  tag     date not null,
  schluessel text not null,
  anzahl  bigint not null default 0,
  primary key (tag, schluessel)
);
alter table public.nutzung enable row level security;
-- Keine Policies: direkter Zugriff ist für alle gesperrt,
-- geschrieben und gelesen wird nur über die Funktionen unten.

-- Zähler erhöhen. p_daten = {"aufruf": 1, "geraet:mobil": 1, ...}
-- Grenzen gegen Missbrauch: höchstens 40 Schlüssel je Aufruf,
-- Schlüssel 1–60 Zeichen (a–z, 0–9, : _ . -), Wert 1–200,
-- höchstens 1500 verschiedene Schlüssel pro Tag.
create or replace function public.nutzung_zaehlen(p_daten jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  heute date := (now() at time zone 'Europe/Berlin')::date;
  k text; v text; n bigint; i int := 0;
  vorhanden int;
begin
  if p_daten is null or jsonb_typeof(p_daten) <> 'object' then return; end if;
  select count(*) into vorhanden from public.nutzung where tag = heute;
  for k, v in select * from jsonb_each_text(p_daten) loop
    i := i + 1;
    exit when i > 40;
    continue when k !~ '^[a-z0-9:_.-]{1,60}$';
    begin n := least(greatest(v::bigint, 0), 200); exception when others then continue; end;
    continue when n = 0;
    if vorhanden >= 1500 and not exists (select 1 from public.nutzung where tag = heute and schluessel = k) then
      continue;
    end if;
    insert into public.nutzung (tag, schluessel, anzahl) values (heute, k, n)
      on conflict (tag, schluessel) do update set anzahl = nutzung.anzahl + excluded.anzahl;
  end loop;
  -- Aufräumen: einmal am Tag reicht, kostet aber auch so kaum etwas.
  if random() < 0.02 then
    delete from public.nutzung where tag < heute - 400;
  end if;
end; $$;
revoke all on function public.nutzung_zaehlen(jsonb) from public;
grant execute on function public.nutzung_zaehlen(jsonb) to anon, authenticated;

-- Auswertung für die Analyseseite (nur Inhaber).
create or replace function public.nutzung_lesen(p_von date, p_bis date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  von date := coalesce(p_von, (now() at time zone 'Europe/Berlin')::date - 29);
  bis date := coalesce(p_bis, (now() at time zone 'Europe/Berlin')::date);
begin
  if not public.is_owner() then
    raise exception 'N-01: nur für den Inhaber';
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
revoke all on function public.nutzung_lesen(date, date) from public;
grant execute on function public.nutzung_lesen(date, date) to authenticated;
