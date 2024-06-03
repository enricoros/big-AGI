-- Table to store our conversations

create table user_conversation (
    id uuid not null,
    systemPurposeId character varying(255) null,
    folderId uuid null,
    created bigint not null,
    updated bigint not null,
    userTitle character varying(255) null,
    autoTitle character varying(255) null,
    messages json null,
    constraint conversation_pkey primary key (id)
  );