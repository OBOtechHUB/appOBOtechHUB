-- =====================================================================
-- 20) Correzione del 15 (condivisione-progetti.sql): progetti di nuovo leggibili, apribili ed eliminabili
-- Le regole sui progetti condivisi leggevano direttamente la tabella progetti_condivisioni, che (giustamente)
-- non è leggibile dagli utenti: ogni lettura dei progetti dava "permission denied for table progetti_condivisioni".
-- Ora il controllo passa da una funzione sicura (stesso risultato). Si può rieseguire. Non cancella nulla.
-- =====================================================================

create or replace function public.condiviso_con_me(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.progetti_condivisioni c where c.progetto = p and c.utente = auth.uid() and c.attiva);
$$;
revoke all on function public.condiviso_con_me(uuid) from public, anon;
grant execute on function public.condiviso_con_me(uuid) to authenticated;

drop policy if exists "progetti_condivisi_lettura" on public.progetti;
create policy "progetti_condivisi_lettura" on public.progetti for select to authenticated
  using (public.condiviso_con_me(id));
drop policy if exists "progetti_condivisi_modifica" on public.progetti;
create policy "progetti_condivisi_modifica" on public.progetti for update to authenticated
  using (public.condiviso_con_me(id))
  with check (public.condiviso_con_me(id));

-- controllo: deve restituire il numero dei tuoi progetti senza errori
select count(*) as progetti_leggibili from public.progetti;
