/**
 * If you need to add transformers for special data types like `Temporal.Instant` or `Temporal.Date`, `Decimal.js`, etc you can do so here.
 * Make sure to import this file rather than `superjson` directly.
 * @link https://github.com/blitz-js/superjson#recipes
 */
import superjson from 'superjson';

/**
 * NOTE: 2024-08-10: this doesn't seem to be needed anymore, as such we use plain `superjson` as-is.
 */
export const transformer = superjson;

// /**
//  * WORKAROUND: an incredibly weird bug with NextJS-14.2.4 + tRPC v11 + SuperJSON
//  *
//  * If the serialized object has 'undefined' values (e.g. {json.name: null, meta.values.name=['undefined']},
//  * superjson will try to apply the format conversion from the 'null' to the 'undefined' value directly to the input object.
//  *
//  * This somehow fails with tRPC-11 and NextJS-14.2.4. There may be immutability somewhere.
//  *
//  * While a slot workaround would be to deepcopy (JSON.parse(JSON.stringify(object)) the object
//  * we use a more lightweight approach that only works on top-level properties.
//  *
//  * May be related to https://github.com/blitz-js/superjson/issues/242 ?
//  * May be related to https://github.com/blitz-js/superjson/issues/283 ?
//  */
// function deserializeWithWorkaround<T = unknown>(object: any): T {
//
//   // Second-level (object.json: {..}) mutability workaround
//   if (object && object instanceof Object && object?.meta && object?.json) {
//     object = { ...object, json: { ...object.json } };
//   }
//
//   return superjson.deserialize<T>(object);
// }
//
//
// export const transformer = {
//   serialize: superjson.serialize,
//   deserialize: deserializeWithWorkaround,
//
//   // The following commented code is here just to let us place breakpoints quickly
//
//   // serialize: (object: any): any => {
//   //   const serialized = superjson.serialize(object);
//   //   return serialized;
//   // }
//
//   // deserialize: (object: any): any => {
//   //   const des = superjson.deserialize(object);
//   //   return des;
//   // }
// };
