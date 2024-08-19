// //
// // WARNING: Everything here is data at rest. Know what you're doing.
// //
//
// import { create } from 'zustand';
// import { persist } from 'zustand/middleware';
//
//
// /// Metrics Store - a store to save mostly usages and costs
//
// interface MetricsState {
// }
//
// interface MetricsActions {
// }
//
// export const useMetricsStore = create<MetricsState & MetricsActions>()(persist(
//   (set) => ({
//
//     // initial state
//
//     // actions
//
//   }),
//   {
//     name: 'app-metrics',
//   },
// ));