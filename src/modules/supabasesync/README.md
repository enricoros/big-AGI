# Supabase Sync - Experimental

## Module Goal

> To sync all conversations from big-agi's localDb to a server and back allowing use on multiple devices while preserving big-agi's private and local approach.

The assumtion here is 1 user will use 1 database, you can share all chats or none.
e.g. this is not intended to keep some chats shared/synced and others private.

## Requirements

- Supabase project setup (free account is fine), you will need your ulr & key
- a table called `conversation` with the following schema

```sql
create table conversation (
    id uuid not null,
    systemPurposeId character varying(255) null,
    created bigint not null,
    updated bigint not null,
    userTitle character varying(255) null,
    autoTitle character varying(255) null,
    messages json null,
    constraint conversation_pkey primary key (id)
  );
  ```

  ## Setup

  Navigate to your hosted instance and set your Supabase URL & KEY under the `Preferences -> Tools -> Supabase Sync`

  NOTE: the `Last Synced` is a way of tracking what chnages you need to get. To do a full sync (possibly loosing any un-synced data) reset this value to 0.
