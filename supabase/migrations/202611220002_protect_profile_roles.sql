-- Profile roles are managed by trusted database operators and the backend.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.role is distinct from 'user' then
        raise exception 'Profile roles are managed by an administrator' using errcode = '42501';
      end if;
    elsif new.role is distinct from old.role then
      raise exception 'Profile roles are managed by an administrator' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
before insert or update on public.profiles
for each row execute function public.protect_profile_role();
