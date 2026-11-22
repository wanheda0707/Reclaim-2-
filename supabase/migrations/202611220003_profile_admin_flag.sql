alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.role is distinct from 'user' or new.is_admin is true then
        raise exception 'Profile permissions are managed by an administrator' using errcode = '42501';
      end if;
    elsif new.role is distinct from old.role or new.is_admin is distinct from old.is_admin
       or (old.is_admin is true and new.id is distinct from old.id) then
      raise exception 'Profile permissions are managed by an administrator' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
