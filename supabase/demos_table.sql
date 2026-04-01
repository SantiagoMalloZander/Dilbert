create table demos (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  company    text not null,
  email      text not null,
  phone      text,
  team_size  text,
  date       date not null,
  time       text not null,
  status     text not null default 'scheduled',
  created_at timestamptz default now(),
  unique (date, time)  -- evita doble booking del mismo slot
);
