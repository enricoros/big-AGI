# Supabase Sync - Experimental

## Module Goal

> To sync all conversations from big-agi's localDb to a server and back allowing use on multiple devices while preserving big-agi's private and local approach.

Supabase supports multi user authentication so this module assumes you will have users setup and users can save their own data/chats to this database and they will not be accessable by other users (e.g. not used for team conversation sharing, if that is desired then get all team members to use same user account)

## Module Status

**Whats working:**

- Sync "Chat Conversations" to Supabase

**Planned:**

- Sync Conversation folders
- Sync other shared user settings like theme, what the "Enter" key does etc

## Supabase Setup

- Supabase project setup (free account is fine), you will need your url & anon-key
- Table called `user_conversation` with the following schema
- Row Level Security (RLS) turned on for this table and policies setup
- One or more supabase user accounts with access to the `user_conversation` table

```sql

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

```

  ## Big-Agi Setup

  Navigate to your hosted instance and set your Supabase URL & KEY under the `Preferences -> Tools -> Supabase Sync` then login with your supabase user

  NOTE: the `Last Synced` is a way of tracking what chnages you need to get. To do a full sync (possibly loosing any un-synced data) reset this value to 0.
