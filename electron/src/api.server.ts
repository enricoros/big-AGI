// import z from 'zod';
// import { initTRPC } from '@trpc/server';
// import { observable } from '@trpc/server/observable';
// import { EventEmitter } from 'events';
// import superjson from 'superjson';
//
// const ee = new EventEmitter();
//
// const t = initTRPC.create({ isServer: true, transformer: superjson });
//
// export const router = t.router({
//   greeting: t.procedure.input(z.object({ name: z.string() })).query((req) => {
//     const { input } = req;
//
//     ee.emit('greeting', `Greeted ${input.name}`);
//     return {
//       text: `Hello ${input.name}` as const,
//     };
//   }),
//   subscription: t.procedure.subscription(() => {
//     return observable((emit) => {
//       function onGreet(text: string) {
//         emit.next({ text });
//       }
//
//       ee.on('greeting', onGreet);
//
//       return () => {
//         ee.off('greeting', onGreet);
//       };
//     });
//   }),
// });
//
// export type AppRouter = typeof router;