import React from 'react';

function DashedBox({ mouse, startPos }) {
  function getRect() {
    return {
      x: Math.min(startPos.x, mouse.docX),
      y: Math.min(startPos.y, mouse.docY),
      w: Math.abs(startPos.x - mouse.docX),
      h: Math.abs(startPos.y - mouse.docY),
    };
  }
  if (startPos) {
    const { x, y, w, h } = getRect();
    return (
      <div
        style={{
          transform: `translate(${x}px,${y}px)`,
          width: w,
          height: h,
          position: 'absolute',
          border: `1px dotted gray`,
        }}
      />
    );
  }
  return null;
}

export default DashedBox;
