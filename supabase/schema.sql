-- Ticket System: capacidad y flujo
-- Ejecutar completo en Supabase > SQL Editor.
-- Fuente única por dato: el catálogo, las personas y las metas se editan aquí
-- (o se importan del Tickets Manual); las fotos de HubSpot las escribe el script de sincronización.

-- ---------- Catálogo (Tickets Manual · Tickets Catalog) ----------
create table if not exists catalogo (
  id               bigserial primary key,
  tipo             text not null,                 -- valor interno de qt_tipo_solicitud
  etiqueta         text,
  segmento         text not null,                 -- debe coincidir con el nombre del pipeline de deal en HubSpot
  equipo           text not null,
  unidad           text not null default 'ticket' check (unidad in ('ticket','sitio')),
  sla_dias         numeric,                       -- días hábiles (0.125 = 1 h)
  esfuerzo_prod_h  numeric,                       -- horas hábiles por unidad
  esfuerzo_rev_h   numeric,                       -- horas de revisión por unidad (Under review)
  estado           text not null default 'supuesto' check (estado in ('firme','supuesto','por_definir')),
  firmado_por      text,
  fecha_firma      date,
  unique (tipo, segmento)
);

-- ---------- Personas (Tickets Manual · Teams) ----------
create table if not exists personas (
  owner_id   text primary key,                    -- hubspot_owner_id
  nombre     text not null,
  equipo     text not null,
  fte        numeric not null default 1,
  jornada_h  numeric not null default 8,
  foco       numeric not null default 0.8 check (foco between 0 and 1),
  activo     boolean not null default true
);

-- ---------- Ausencias (manual hoy; Factorial o Google Calendar después) ----------
create table if not exists ausencias (
  id        bigserial primary key,
  owner_id  text not null references personas(owner_id) on delete cascade,
  fecha     date not null,
  horas     numeric not null default 8,           -- 4 = medio día
  fuente    text not null default 'manual',       -- manual | factorial | calendar
  nota      text,
  unique (owner_id, fecha)
);

-- ---------- Feriados (Tickets Manual · Feriados) ----------
create table if not exists feriados (
  fecha   date primary key,
  nombre  text
);

-- ---------- Meta mensual (Company Goal) ----------
create table if not exists metas (
  mes     date primary key,                       -- primer día del mes
  sitios  integer not null,
  kwp     numeric not null
);

-- ---------- Etapas de deal (las llena el script; es_instalado se marca a mano) ----------
create table if not exists etapas_deal (
  etapa_id     text primary key,
  etiqueta     text,
  pipeline     text,
  orden        integer,
  es_instalado boolean not null default false     -- marcar true en la etapa de inicio de instalación (2.15)
);

-- ---------- Fotos diarias de HubSpot ----------
create table if not exists snapshots (
  snapshot_date date primary key,
  creado        timestamptz not null default now()
);

create table if not exists deals_snapshot (
  snapshot_date     date not null references snapshots(snapshot_date) on delete cascade,
  deal_id           text not null,
  nombre            text,
  segmento          text,
  etapa_id          text,
  kwp               numeric,
  fecha_instalacion date,
  primary key (snapshot_date, deal_id)
);

create table if not exists tickets_snapshot (
  snapshot_date  date not null references snapshots(snapshot_date) on delete cascade,
  ticket_id      text not null,
  asunto         text,
  tipo           text,
  segmento       text,
  equipo         text,                            -- pipeline de tickets
  etapa_ticket   text,                            -- New / In progress / Under review / Closed…
  owner_id       text,
  creado         timestamptz,
  cerrado        timestamptz,
  deal_ids       text[],
  sitios         integer not null default 1,
  primary key (snapshot_date, ticket_id)
);

create index if not exists deals_snapshot_etapa on deals_snapshot (snapshot_date, etapa_id);
create index if not exists tickets_snapshot_owner on tickets_snapshot (snapshot_date, owner_id);

-- ---------- Seguridad ----------
-- Solo personas autenticadas con correo del dominio pueden leer.
-- El script de sincronización usa la service role key y no pasa por RLS.
-- Para editar catálogo, personas, ausencias y metas, usar el Table Editor de Supabase.
do $$
declare t text;
begin
  foreach t in array array['catalogo','personas','ausencias','feriados','metas',
                           'etapas_deal','snapshots','deals_snapshot','tickets_snapshot']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists lectura_dominio on %I', t);
    execute format($p$create policy lectura_dominio on %I for select to authenticated
                     using ((auth.jwt() ->> 'email') like '%%@niko.mx')$p$, t);
  end loop;
end $$;

-- ---------- Datos iniciales ----------
insert into metas (mes, sitios, kwp) values
  ('2026-11-01', 80, 1200), ('2026-12-01', 80, 1200), ('2027-01-01', 80, 1200)
on conflict (mes) do nothing;

insert into feriados (fecha, nombre) values
  ('2026-11-16','Revolución'), ('2026-12-25','Navidad'),
  ('2027-01-01','Año Nuevo'), ('2027-02-01','Constitución'),
  ('2027-03-15','Natalicio de Benito Juárez'), ('2027-05-01','Día del Trabajo'),
  ('2027-09-16','Independencia'), ('2027-11-15','Revolución'), ('2027-12-25','Navidad')
on conflict (fecha) do nothing;
