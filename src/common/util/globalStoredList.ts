// import { create } from 'zustand';
// import { persist } from 'zustand/middleware';
//
//
// type TaggedListItem<TId extends string, TTag extends string> = {
//   id: TId;
//   listTags: TTag[];
// }
//
// /**
//  * Create a persistent list of type TaggedListItem that will handle list functions, and item editing functions.
//  *  - your item can have all the properties you want, but must have an id and listTags property
//  *  - your item will be serialized/de-serialized to/from localStorage, make sure it's JSON-serializable
//  */
// export function createStoredTaggedList<TItem extends TaggedListItem<string, string>>(persistName: string) {
//
//   // Infer TId and TTag from TItem's id and listTags array type
//   type TId = TItem['id'];
//   type TTag = TItem['listTags'][number];
//
//   type SelectionMap = {
//     [K in TTag]?: TId;
//   };
//
//   type TaggedListState = {
//     // State
//     items: TItem[];
//     selections: SelectionMap; // Maps TTag to selected TId
//
//     // Actions
//     addItem: (item: TItem) => void;
//     removeItem: (itemId: TId) => void;
//     modifyItem: (itemId: TId, changes: Partial<TItem>) => void;
//     modifyItemDeep: (itemId: TId, updater: (item: TItem) => TItem) => void;
//
//     selectItemForTag: (tag: TTag, itemId: TId) => void;
//   };
//
//   return create<TaggedListState>()(persist((set, get) => ({
//
//         items: [] as TItem[],
//         selections: {} as SelectionMap,
//
//
//         addItem: (item: TItem) => set((state: TaggedListState) => ({
//           items: [...state.items, item],
//         })),
//
//         removeItem: (itemId: TId) => set((state: TaggedListState) => ({
//           items: state.items.filter((item: TItem) => item.id !== itemId),
//           selections: Object.fromEntries(
//             Object.entries(state.selections).filter(([, selectedId]) => selectedId !== itemId),
//           ) as SelectionMap,
//         })),
//
//         modifyItem: (itemId: TId, changes: Partial<TItem>) => set((state: TaggedListState) => ({
//           items: state.items.map((item: TItem) => item.id === itemId ? { ...item, ...changes } : item),
//         })),
//
//         modifyItemDeep: (itemId: TId, updater: (item: TItem) => TItem) => set((state: TaggedListState) => ({
//           items: state.items.map((item: TItem) => item.id === itemId ? updater(item) : item),
//         })),
//
//
//         selectItemForTag: (tag: TTag, itemId: TId) => {
//           const item = get().items.find((item) => item.id === itemId);
//           if (item && item.listTags.includes(tag)) {
//             set((state) => ({
//               selections: { ...state.selections, [tag]: itemId },
//             }));
//           } else {
//             console.warn(`Item with id ${itemId} does not support tag ${tag} and cannot be selected for it.`);
//           }
//         },
//
//       }),
//
//       {
//         name: persistName,
//       }),
//   );
// }
//
//
// /* Example:
//
// // Define the specific subtype for VoiceOutModel
// type VoiceModelId = string;
// type VoiceModelTag = 'voice' | 'text' | 'image' | 'video' | 'audio';
//
// // Define the VoiceOutModel interface
// export interface VoiceOutModel extends TaggedListItem<VoiceModelId, VoiceModelTag> {
//   music: string;
//   count: number;
//   fruits: string[];
// }
//
// // Create the Zustand store with the specific VoiceOutModel type
// const useVoiceOutModels = createStoredTaggetList<VoiceOutModel>('app-voice-synth');
//
// export const useVoiceModel = (modelId: VoiceModelId) => {
//   const { item, modifyItem } = useVoiceOutModels(useShallow(state => ({
//     item: state.items.find(item => item.id === modelId) as Readonly<VoiceOutModel>,
//     modifyItem: state.modifyItem,
//   })));
//
//   // Memoize all the update functions at once
//   const { setMusic, setCount, setFruits } = React.useMemo(() => ({
//     setMusic: (music: string) => modifyItem(modelId, { music }),
//     setCount: (count: number) => modifyItem(modelId, { count }),
//     setFruits: (fruits: string[]) => modifyItem(modelId, { fruits }),
//   }), [modifyItem, modelId]);
//
//   return { item, setMusic, setCount, setFruits };
// };
// */