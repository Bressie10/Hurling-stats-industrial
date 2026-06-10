-- Squad player ids are local roster ids and repeat for every coach.
-- Cloud sync upserts by (id, user_id), so the table must use the same
-- conflict target instead of a globally unique id.
alter table squad drop constraint if exists squad_pkey;

alter table squad
  add constraint squad_pkey primary key (id, user_id);
