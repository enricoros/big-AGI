import * as React from 'react';

import { modelPickOrAuto } from '~/common/util/modelPickUtils';

import { FormChipControl } from './FormChipControl';


const _AUTO = 'auto' as const;

export type FormChipModelLabels<TModel extends string> = Readonly<Record<TModel, { label: string, description?: string, tooltip?: string }>>;


/**
 * Engine model picker: an 'Auto' chip (stores no model - see modelPickOrAuto) followed by the catalog's models.
 * The labels are keyed by the catalog, so a model added or retired without its label fails the build.
 */
export function FormChipModelControl<TModel extends string>(props: {
  title?: string;
  catalog: readonly TModel[];
  labels: FormChipModelLabels<TModel>;
  autoModel: TModel; // what Auto resolves to today - shown as the Auto chip's description
  value: string | undefined; // the stored pick; unset or retired = Auto
  onChange: (pick: TModel | undefined) => void;
}) {

  const { catalog, labels, autoModel, onChange } = props;

  const value = modelPickOrAuto(props.value, catalog) ?? _AUTO;

  const options = React.useMemo(() => [
    { value: _AUTO, label: 'Auto', description: labels[autoModel].label },
    ...catalog.map(model => ({ value: model, ...labels[model] })),
  ], [autoModel, catalog, labels]);

  return (
    <FormChipControl<string>
      title={props.title ?? 'Model'}
      alignEnd
      options={options}
      value={value}
      hintValue={value === _AUTO ? autoModel : undefined} // Auto: show which model it runs
      onChange={value => onChange(modelPickOrAuto(value, catalog) /* 'auto' is not in the catalog: undefined */)}
    />
  );
}
