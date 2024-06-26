-- Table to store our conversations

create table user_conversation (
    id uuid not null,
    "systemPurposeId" character varying(255) null,
    "folderId" uuid null,
    created bigint not null,
    updated bigint not null,
    "userTitle" character varying(255) null,
    "autoTitle" character varying(255) null,
    messages json null,
    user_id uuid null default auth.uid (),
    constraint user_conversation_pkey primary key (id)
  );

create policy "Users can mange their own data"
on "public"."user_conversation"
to public
using (
 (auth.uid() = user_id)
);