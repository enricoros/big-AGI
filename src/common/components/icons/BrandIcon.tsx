import * as React from 'react';

interface BrandIconProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  // We can add specific props if needed in the future, e.g., for different logo versions
}

export function BrandIcon(props: BrandIconProps) {
  const { src, alt, style, ...rest } = props;

  const defaultStyle: React.CSSProperties = {
    // Let's assume a default size, can be overridden by props.style
    width: 32, // Default width
    height: 32, // Default height
  };

  return (
    <img
      src={src || '/icons/custom-logo.png'}
      alt={alt || 'Brand Logo'}
      style={{ ...defaultStyle, ...style }}
      {...rest}
    />
  );
}
