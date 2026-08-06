import type { ModelDescriptionSchema } from './llm.server.types';


/**
 * Variant map type - maps base model ID to one or more variant definitions
 * Single variant: { 'model-id': { idVariant: 'foo', ... } }
 * Multiple variants: { 'model-id': [{ idVariant: 'foo', ... }, { idVariant: 'bar', ... }] }
 */
export type ModelVariantMap = Record<
  string, _ModelVariantDefinition | _ModelVariantDefinition[]
>;


type _ModelVariantDefinition = Partial<ModelDescriptionSchema> & {
  /**
   * - `::` is a special reserved prefix for variants that will not prefixed with '-'
   * - any other variant id will be prefixed as `-${idVariant}`
   */
  idVariant: string;                    // Required - variant identifier suffix
  variantOrder?: 'before' | 'after';    // Optional - where to inject relative to base (default: factory function, or 'after')
};

type _ModelVariantReducer = (acc: ModelDescriptionSchema[], model: ModelDescriptionSchema) => ModelDescriptionSchema[];


/** Creates a variant injection reducer function. */
export function createVariantInjector(
  variantMap: ModelVariantMap,
  defaultOrder: 'before' | 'after' = 'after',
): _ModelVariantReducer {
  return (acc, model) => {

    // early exit if no variants for this model
    const entry = variantMap[model.id];
    if (!entry) {
      acc.push(model);
      return acc;
    }

    // have variants
    const variants = Array.isArray(entry) ? entry : [entry];

    // add 'before' variants
    const beforeVariants = variants.filter(v => (v.variantOrder ?? defaultOrder) === 'before');
    for (const { variantOrder: _, ...variant } of beforeVariants)
      acc.push({ ...model, ...variant });

    // add base model
    acc.push(model);

    // add 'after' variants
    const afterVariants = variants.filter(v => (v.variantOrder ?? defaultOrder) === 'after');
    for (const { variantOrder: _, ...variant } of afterVariants)
      acc.push({ ...model, ...variant });

    return acc;
  };
}
