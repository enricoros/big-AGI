# Trade - Export and Import

SHIPPED. One export file for everything the app holds, and one import that reads any file Big-AGI ever
wrote, shows what it would do, and only then does it. The contracts of record are `TradeFile` (the file,
persisted on users' disks) and `TradeAdapter` (what a kind of data implements to be exported and
imported), both in the trade module's types. This doc owns the model and the rules the code cannot say.

## Why

Before this, no export held everything, and each one silently left something out. Import had no preview:
depending on the button, the same file replaced a chat that was newer on the device, or made a copy of
every chat under a new id. A settings file was rejected by the button that takes JSON. Restoring settings
erased every stored value first.

## Model

An export file is a snapshot of one device's data. Importing merges it into this device: each item of the
file is related to the local item with the same id, the relations are shown, and the writes follow from
them. Nothing is written while a file is read. What is decided is the pair the preview showed: an item
that changed on the device since then (a reply still arriving) is not replaced, and stays listed.

Ids never change on import. The same object has the same id on every device and in every file, which is
what makes a second import of the same file a no-op and an export, edit elsewhere, import cycle an update.
The one exception is "keep both", chosen by the user: the file's version becomes a new object.

## The file

Sections of items, one section per kind of data. Rules that hold forever:
- Readers ignore fields they do not know.
- A section of a kind or schema the build cannot read is named in the preview as not imported. It is never
  dropped silently and never stops the rest.
- `requires` lists what a reader must understand, on the file or on a section. A reader refuses that scope
  on a token it does not know. No token exists yet: this is the way to add what an old reader must not
  half-apply.
- `schemaVersion` moves only when old readers cannot survive the change.
- Metadata sits beside an item's data, never inside it. The only one defined is a vector clock, written by
  builds that keep a version history per item.
- The top level has no `conversations` and no `messages` key, so the importers shipped before reject the
  file as a whole.

A section's `schema` names the schema its items already have at rest, which has an owner and an upgrade
path: a conversation as the chat store persists it, a store's value as the store persists it (so the
store migrates it at the next load). The export defines no entity format of its own.

The file is one JSON text, one string when it is written and when it is read, and an engine caps a string
(Chrome near 512 MB). A file over 500 MB is refused with a message, on both sides, so that what is saved can
be read back in any browser.

An export, and a single conversation download, is named `<name>_agi.json` (`_agi.md` for Markdown): one
extension only. A compound `.agi.json` is saved as `.agi` by a save dialog that hides the known extension,
where `.agi` is a type the system knows. A device backup, where a build writes one, keeps its own name.
Reading goes by content, never by name; the name only decides whether a file dropped on a chat is imported
or attached.

## What an item needs

A kind can name the items of other kinds that one of its items needs to be whole. The export says, on the
row of a kind, how many of its items need something the selection leaves out. The import says how many of
the items that arrive need something that is neither on the device nor in the files. Both only count:
nothing is added to a selection, and nothing is refused. No kind of this build names any.

## Relations

| relation | meaning | default |
|---|---|---|
| new | not on this device | add |
| same | same content | nothing |
| ahead | the file's version is a successor of the local one | take the file's |
| behind | the local version is a successor | nothing |
| mergeable | both sides added, nothing collides | merge |
| conflict | both sides changed the same thing | ask |
| removed | deleted on this device | nothing |

Without a version history, the relation comes from content alone, through `analyzeMerge`: the side that
only adds is the successor, additions on both sides merge, and a value or an id-matched array item that
differs on the two sides is a conflict. Timestamps are not used: `updated` is not touched by a rename, an
archive or a star. What a device rewrites on its own (token counts, empty flag lists, local file handles,
the ids of message fragments, which the oldest files do not have) is left out of the comparison.

There is no common base, so an item deleted on one side and present on the other reads as an addition and
comes back. This is the chosen side of the trade-off: a returned message can be deleted again, a lost one
cannot be recovered.

Each kind of data states its own rule on top:
- Conversations match messages by id. Two sides that each have messages the other lacks are two
  continuations, and a linear chat cannot hold both: a conflict, where the user takes the file's, keeps
  this device's, or keeps both.
- Folders merge membership as a union; a title or a color that differs is a conflict.
- Stored values (settings, credentials) have no history: a different value in the file replaces this
  device's. A value saved by a newer version of its store is refused, since stores migrate forward only.

Several loaded files holding the same id are ordered among themselves first, by the same rules.

## Settings and credentials

An allowlist names the stores an export holds; a store that is not listed stays on its device. This is
deliberate: a new store is left out until someone decides it travels, and view state, identity, sessions
and logs never do. Stores that hold API keys are a separate kind, off by default on export.

Inside a listed store, the state that describes the device stays as well: usage counters, dismissed hints,
what was last open. It differs between any two devices, so it is not exported, not compared, and an import
leaves this device's in place. Files written before hold it, and are read past it.

Some stored values travel in no file at all, the device backup included: the shared chat links with their
deletion keys, the open panes, the sign-in cache, the analytics client's state, and a marker that a
removed banner left in some browsers. A backup does not save them, and a restore neither writes them, from
an older backup that holds them, nor removes this device's.

On import neither is selected by default: they replace this device's values and can point a service at
another host, so the user ticks them. A store the file does not hold is unchanged. Writes take effect at
reload, done right after the write so that no live store saves its old state back.

## Files written before

Every earlier file is read into the same sections: the per-chat and all-chats JSON (with or without a
schema tag), persona files, and device backups in every spelling of their schema. Each is detected by its
shape, in a fixed order, and its items are read by the converters that always read them. Fields an older
chat file cannot carry (the archive flag, the chat symbol) keep this device's value. The AI services that
all-chats files embed, keys included, are offered unselected, and added only where this device has no
service with that id. What a device backup holds that belongs to its device is named, not imported.

A device backup imports like any file: its chats, folders, settings and credentials, merged, with the
preview. Where a build has the device restore, which replaces everything, it is not a second way in: it is
offered in that preview only for a backup saved with its images, which nothing else brings back.

## Gaps

- Images and other binaries are not in the export; chats import with their image references and show a
  missing image where the device does not have it. Both dialogs say so.
- Deletions are not exported, so an import never deletes.
- The per-chat JSON download still writes the older single-chat file.
- There is no undo: a conflict resolved to the file's version replaces the local one. Saving the replaced
  versions from the result is PROPOSED.
- Comparing the two versions of a conflict is a side by side text diff, the same for every kind of data.
- An export is one JSON text of at most 500 MB: a larger history does not export as one file yet.
