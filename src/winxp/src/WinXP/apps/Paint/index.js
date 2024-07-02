import React from 'react';

// add child div to capture mouse event when not focused

function Paint({ onClose, isFocus }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      <iframe
        src="https://jspaint.app"
        frameBorder="0"
        title="paint"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          backgroundColor: 'rgb(192,192,192)',
        }}
      />
      {!isFocus && (
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            left: 0,
            top: 0,
          }}
        />
      )}
    </div>
  );
}

export default Paint;
