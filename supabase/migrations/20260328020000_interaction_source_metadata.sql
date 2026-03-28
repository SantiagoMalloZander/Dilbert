alter table interactions
  add column if not exists source_type text,
  add column if not exists source_chat_id bigint,
  add column if not exists source_message_id bigint,
  add column if not exists source_user_id bigint,
  add column if not exists source_message_key text;

create unique index if not exists idx_interactions_source_message_key
  on interactions(source_message_key)
  where source_message_key is not null;
