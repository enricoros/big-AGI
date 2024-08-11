// import * as React from 'react';
// import { StoreApi } from 'zustand';
//
//
// // https://x.com/mattpocockuk/status/1780865485325979685?s=46&t=cmQVCdpY7_bVoOftn8NIcg
// const createZustandContext = <TInitial, TStore extends StoreApi<any>, >(getStore: (initial: TInitial) => TStore) => {
//   const Context = React.createContext(
//     null as any as TStore,
//   );
//
//   const Provider = (props: {
//     children?: React.ReactNode;
//     initialValue: TInitial;
//   }) => {
//     const [store] = React.useState(() =>
//       getStore(props.initialValue),
//     );
//
//     return (
//       <Context.Provider value={store}>
//         {props.children}
//       </Context.Provider>
//     );
//   };
//
//   return {
//     useContext: () => React.useContext(Context),
//     Context,
//     Provider,
//   };
// };