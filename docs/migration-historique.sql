-- Rituel — la memoire des actifs, cote serveur.
--
-- A coller tel quel dans Supabase : tableau de bord du projet > SQL Editor >
-- New query > Run. C'est sans risque : la table n'existe pas encore, rien
-- d'existant n'est touche.
--
-- POURQUOI cette table. L'abonnement de Rituel vend une seule chose : la
-- memoire longue de ce que la peau a recu. Tant qu'elle vit dans le
-- navigateur, elle disparait au changement de telephone ou au vidage du cache
-- - on vend alors une chose qu'on ne stocke pas. Cote code, src/v2/historique.js
-- bascule tout seul sur cette table des qu'elle existe, et continue de
-- fonctionner en local si elle est absente.
--
-- POURQUOI une table separee de `entries`. Les colonnes routine_matin et
-- routine_soir de `entries` sont des BOOLEENS (« routine faite ou non »), pas
-- une liste d'actifs. Les detourner casserait l'ancienne application, qui les
-- lit encore.

create table if not exists public.historique_actifs (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  moment text not null check (moment in ('matin', 'soir')),
  actifs text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, date, moment)
);

-- Chacun ne voit et n'ecrit que sa propre memoire.
alter table public.historique_actifs enable row level security;

create policy "chacun lit sa memoire"
  on public.historique_actifs for select
  using (auth.uid() = user_id);

create policy "chacun ecrit sa memoire"
  on public.historique_actifs for insert
  with check (auth.uid() = user_id);

create policy "chacun corrige sa memoire"
  on public.historique_actifs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "chacun efface sa memoire"
  on public.historique_actifs for delete
  using (auth.uid() = user_id);

-- La lecture se fait toujours par utilisateur et par date.
create index if not exists historique_actifs_user_date
  on public.historique_actifs (user_id, date desc);
