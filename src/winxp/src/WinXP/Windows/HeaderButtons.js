import React from 'react';
import styled from 'styled-components';

function HeaderButtons({
  buttons,
  onMaximize,
  onMinimize,
  onClose,
  maximized,
  resizable,
  className,
}) {
  const buttonElements = {
    minimize: (
      <button
        key="minimize"
        className="header__button header__button--minimize"
        onMouseUp={onMinimize}
      />
    ),
    maximize: (
      <button
        key="maximize"
        className={`header__button ${
          maximized ? 'header__button--maximized' : 'header__button--maximize'
        } ${resizable ? '' : 'header__button--disable'}`}
        onMouseUp={onMaximize}
      />
    ),
    close: (
      <button
        key="button"
        className="header__button header__button--close"
        onMouseUp={onClose}
      />
    ),
  };

  return (
    <div className={className}>
      {buttons ? (
        buttons.map(b => buttonElements[b])
      ) : (
        <>
          {buttonElements.minimize}
          {buttonElements.maximize}
          {buttonElements.close}
        </>
      )}
    </div>
  );
}

export default styled(HeaderButtons)`
  opacity: ${({ isFocus }) => (isFocus ? 1 : 0.6)};
  height: 22px;
  display: flex;
  align-items: center;
  margin-top: -1px;
  margin-right: 1px;
  .header__button {
    margin-right: 1px;
    position: relative;
    width: 22px;
    height: 22px;
    border: 1px solid #fff;
    border-radius: 3px;
    &:hover {
      filter: brightness(120%);
    }
    &:hover:active {
      filter: brightness(90%);
    }
  }
  .header__button--minimize {
    box-shadow: inset 0 -1px 2px 1px #4646ff;
    background-image: radial-gradient(
      circle at 90% 90%,
      #0054e9 0%,
      #2263d5 55%,
      #4479e4 70%,
      #a3bbec 90%,
      white 100%
    );
    &:before {
      content: '';
      position: absolute;
      left: 4px;
      top: 13px;
      height: 3px;
      width: 8px;
      background-color: white;
    }
  }
  .header__button--maximize {
    box-shadow: inset 0 -1px 2px 1px #4646ff;
    background-image: radial-gradient(
      circle at 90% 90%,
      #0054e9 0%,
      #2263d5 55%,
      #4479e4 70%,
      #a3bbec 90%,
      white 100%
    );
    &:before {
      content: '';
      position: absolute;
      display: block;
      left: 4px;
      top: 4px;
      box-shadow: inset 0 3px white, inset 0 0 0 1px white;
      height: 12px;
      width: 12px;
    }
  }
  .header__button--maximized {
    box-shadow: inset 0 -1px 2px 1px #4646ff;
    background-image: radial-gradient(
      circle at 90% 90%,
      #0054e9 0%,
      #2263d5 55%,
      #4479e4 70%,
      #a3bbec 90%,
      white 100%
    );
    &:before {
      content: '';
      position: absolute;
      display: block;
      left: 7px;
      top: 4px;
      box-shadow: inset 0 2px white, inset 0 0 0 1px white;
      height: 8px;
      width: 8px;
    }
    &:after {
      content: '';
      position: absolute;
      display: block;
      left: 4px;
      top: 7px;
      box-shadow: inset 0 2px white, inset 0 0 0 1px white, 1px -1px #136dff;
      height: 8px;
      width: 8px;
      background-color: #136dff;
    }
  }
  .header__button--close {
    box-shadow: inset 0 -1px 2px 1px #da4600;
    background-image: radial-gradient(
      circle at 90% 90%,
      #cc4600 0%,
      #dc6527 55%,
      #cd7546 70%,
      #ffccb2 90%,
      white 100%
    );
    &:before {
      content: '';
      position: absolute;
      left: 9px;
      top: 2px;
      transform: rotate(45deg);
      height: 16px;
      width: 2px;
      background-color: white;
    }
    &:after {
      content: '';
      position: absolute;
      left: 9px;
      top: 2px;
      transform: rotate(-45deg);
      height: 16px;
      width: 2px;
      background-color: white;
    }
  }
  .header__button--disable {
    outline: none;
    opacity: 0.5;
    &:hover {
      filter: brightness(100%);
    }
  }
`;
