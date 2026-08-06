import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';


export function BigAgiCircleInnerIcon(props: { outerColor: string, compensateThinline?: boolean } & SvgIconProps) {
  const { outerColor, compensateThinline, ...rest } = props;
  return (
    <SvgIcon viewBox='0 0 24 24' width='24' height='24' {...rest}>
      {props.outerColor && <circle cx='12' cy='12' r={props.compensateThinline ? 11.95 : 12} fill={props.outerColor} />}
      <path d='M14.703 1.977c-.579.144-1.118.408-1.65.671-.471.252-.936.528-1.326.897-.345.326-1.035 1.061-.993 2.605.02.584.154 1.155.268 1.725.215 1.151.101 1.685.02 1.963-.271.92-1.13 1.472-1.4 1.627-.351.2-.927.404-1.01.46-.069.047-.224.29-.133.348 2.125 1.368 1.615 1.327 2.763 1.34.293.37.386.654.492 1.104.115.513.092 1.334.092 1.334l-.017 7.935A12 12 0 0 0 12 24a12 12 0 0 0 1.99-.186c.007-2.555.016-5.1.006-7.697-.02-.745-.083-1.187-.545-1.869-.358-.599-.954-.942-1.515-1.322.324-.204 1.18-.815 1.49-1.795.172-.543.18-1.225.033-2.063-.072-.411-.26-1.123-.293-1.677-.112-1.912.96-2.615 2.164-3.239.515-.246 1.043-.509 1.613-.595l-2.24-1.58z' />
    </SvgIcon>
  );
}