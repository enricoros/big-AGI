import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';


export function BigAgiCircleIcon(props: { innerColor?: string, compensateThinLine?: boolean } & SvgIconProps) {
  const { innerColor, compensateThinLine, ...rest } = props;
  return (
    <SvgIcon viewBox='0 0 24 24' width='24' height='24' {...rest}>
      {props.innerColor && <circle cx='12' cy='12' r={props.compensateThinLine ? 11.925 : 12} fill={props.innerColor} />}
      <path d='M12 0C5.352 0 0 5.353 0 12.002A11.973 11.973 0 0 0 11.813 24l.017-7.962s.023-.82-.091-1.332c-.107-.45-.198-.734-.49-1.104-1.148-.013-.64.03-2.762-1.336-.091-.059.065-.303.132-.35.084-.057.658-.259 1.008-.46.27-.154 1.128-.706 1.399-1.624.081-.277.195-.811-.02-1.962-.114-.57-.246-1.14-.266-1.723-.042-1.542.647-2.278.99-2.603.39-.37.856-.644 1.327-.895.532-.264 1.07-.527 1.648-.672l2.237 1.58c-.57.087-1.095.348-1.61.594-1.202.624-2.276 1.325-2.164 3.235.033.554.222 1.265.293 1.676.146.837.139 1.518-.033 2.06-.31.98-1.164 1.593-1.488 1.796.56.38 1.156.72 1.513 1.319.461.68.525 1.124.545 1.87.01 2.608.001 5.164-.006 7.73A11.972 11.972 0 0 0 24 12.003C24 5.352 18.648 0 12 0Z' />
    </SvgIcon>
  );
}