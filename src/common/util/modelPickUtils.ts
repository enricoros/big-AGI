/**
 * Engine model picks (TTS, STT, image): an unset pick is Auto - each call resolves the vendor's current default, so an
 * engine configured today keeps working when that model retires. A stored pick that its catalog no longer lists
 * (a retired model, or one from an older build) resolves as Auto too.
 *
 * @returns the pick when the catalog lists it, else undefined (Auto)
 */
export function modelPickOrAuto<TModel extends string>(pick: string | null | undefined, catalog: readonly TModel[]): TModel | undefined {
  return catalog.find(model => model === pick);
}
