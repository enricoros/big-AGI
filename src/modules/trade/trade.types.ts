/**
 * Trade: the export file, and the contract between the trade dialogs and the data they move.
 *
 * An export file is a snapshot of this device's data. Importing merges it into this device: each
 * item of the file is related to the local item with the same id, and only then written.
 *
 * TradeFile is PERSISTED on users' disks: add fields, section types and schemas; never reinterpret one.
 */


// -- The file (persisted) --

export interface TradeFile {
  schema: 'vnd.agi.export';
  schemaVersion: 1;                     // changes only when older readers cannot survive the change; a reader refuses a higher one
  origin: {
    app: 'Big-AGI';
    tenantSlug: string;                 // Release.TenantSlug of the writer
    exported: string;                   // ISO-8601
  };
  requires?: string[];                  // a reader refuses the file on a token it does not know; none are defined yet
  sections: TradeSection[];
}

export interface TradeSection {
  type: string;                         // which TradeAdapter reads it: 'chat', 'folder', 'settings', ...
  schema: string;                       // the at-rest schema of each item's data, e.g. 'app-chats.v4'
  requires?: string[];                  // as above, for this section only
  items: TradeItem[];
}

export interface TradeItem {
  id: string;                           // equals the id inside data
  data: unknown;                        // JSON
  meta?: {                              // beside the data, never inside. Readers ignore the keys they do not know
    vectorClock?: Readonly<Record<string, number>>;
  };
}


// -- Relating a file item to the local one --

export type TradeRelation =
  | 'new'                               // not on this device
  | 'same'                              // same content
  | 'ahead'                             // the file's version is a successor of the local one
  | 'behind'                            // the local version is a successor of the file's
  | 'mergeable'                         // both sides added, nothing collides
  | 'conflict'                          // both sides changed the same thing
  | 'removed';                          // deleted on this device

export type TradeRelated =
  | { relation: 'same' | 'ahead' | 'behind' | 'conflict' }
  | { relation: 'mergeable', merged: unknown };

export type TradeResolution =
  | 'add'                               // write the file's item, new here
  | 'accept-incoming'                   // replace the local item with the file's
  | 'accept-local'                      // keep the local item, the file's version was seen
  | 'merge'                             // write the merged value
  | 'keep-both';                        // keep the local item, add the file's as a new object with a new id

export interface TradeOp {
  item: TradeItem;                      // the file's
  local?: TradeItem;                    // the local version the preview showed, when there was one
  relation: TradeRelation;              // how the preview related the two
  resolution: TradeResolution;
  merged?: unknown;                     // for 'merge'
}


// -- The adapter: one kind of data that can be exported and imported --

export interface TradeAdapter {
  type: string;                         // the section type it writes and reads
  label: string;
  labelPlural: string;
  schema: string;                       // the section schema it writes
  importOnly?: true;                    // never offered for export
  secrets?: true;                       // may hold credentials: labeled, never selected by default
  appliesOnReload?: true;               // its writes take effect at the next load
  unavailable?: string;                 // cannot be traded right now: shown disabled with this reason

  /** Local items in portable form: the comparison side, and the export source. */
  localItems: () => Promise<{ items: TradeItem[], removedIds?: readonly string[] }>;

  /**
   * A file section into portable items of this build. Reads the adapter's own schema, older ones, the other line's.
   * A field the section's schema cannot carry keeps the value of the local item with the same id.
   */
  readSection: (section: TradeSection, local: ReadonlyMap<string, TradeItem>) => { items: TradeItem[], rejected: TradeRejected[] };

  /** How a file item stands to the local item with the same id. */
  relate: (incoming: TradeItem, local: TradeItem) => TradeRelated;

  /** A row of the preview. */
  describe: (item: TradeItem) => { title: string, detail?: string };

  /** The item as text, for the side by side comparison of two versions. Absent: its JSON. */
  compareText?: (item: TradeItem) => string;

  /**
   * The items of other kinds that this one needs to be whole, by section type: a conversation, its personas.
   * An export says which of them it leaves out, an import which of them it does not bring. Absent: none.
   */
  refersTo?: (item: TradeItem) => { type: string, ids: readonly string[] }[];

  /**
   * Writes the decided operations. What was decided is the pair the preview showed: an item that changed
   * on the device since then is not replaced, and comes back as failed with the reason.
   */
  apply: (ops: TradeOp[]) => Promise<{ failed: TradeRejected[] }>;
}

/**
 * What is known of a kind of data wherever it is stored: reading its files, relating two versions, showing
 * one, and making a copy of one. An adapter is this plus a store, and does every other write; a build that
 * stores the kind differently puts its own around it.
 */
export type TradeContent = Pick<TradeAdapter, 'readSection' | 'relate' | 'describe' | 'compareText' | 'refersTo'> & {
  /**
   * Adds the item as a new object with new ids, the way the app makes one: the write of 'keep-both'.
   * @throws if the copy cannot be made
   */
  copy: (item: TradeItem) => void;
};

export interface TradeRejected {
  id?: string;                          // the item's
  title?: string;                       // what it is shown by, where it could be read: otherwise its id
  reason: string;
}
