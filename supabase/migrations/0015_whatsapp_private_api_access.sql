-- Keep personal phone numbers and conversation content outside the browser's PostgREST schema.
-- Authenticated reads go through user-scoped server endpoints; service_role remains server-only.
revoke select on public.sds_whatsapp_links from authenticated;
revoke select on public.sds_whatsapp_messages from authenticated;

-- Cover foreign keys used by deletes and conversation/evidence lookups.
create index if not exists sds_whatsapp_messages_question_idx
  on public.sds_whatsapp_messages (question_id);
create index if not exists sds_whatsapp_messages_concept_idx
  on public.sds_whatsapp_messages (concept_id);
create index if not exists sds_whatsapp_messages_course_idx
  on public.sds_whatsapp_messages (course_id);
create index if not exists sds_whatsapp_messages_attempt_idx
  on public.sds_whatsapp_messages (attempt_id);
create index if not exists sds_whatsapp_messages_reply_idx
  on public.sds_whatsapp_messages (in_reply_to_id);
