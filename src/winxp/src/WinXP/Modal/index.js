import React from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';

import { POWER_STATE } from 'WinXP/constants';
import windowsLogo from 'assets/windowsIcons/windows-off.png';
import off from 'assets/windowsIcons/310(32x32).png';
import lock from 'assets/windowsIcons/546(32x32).png';
import restart from 'assets/windowsIcons/restart.ico';
import switcher from 'assets/windowsIcons/290.png';

function Modal(props) {
  return createPortal(
    <StyledContainer>
      <Menu {...props} />
    </StyledContainer>,
    document.body,
  );
}

const Container = ({ className, children }) => {
  function noop(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  return (
    <div
      className={className}
      onMouseMove={noop}
      onClick={noop}
      onMouseDown={noop}
      onMouseUp={noop}
    >
      {children}
    </div>
  );
};
const Menu = ({ mode, onClose, onClickButton }) => {
  function renderButtons() {
    if (mode === POWER_STATE.TURN_OFF) {
      return (
        <>
          <ButtonDisabled img={off} text="Stand By" />
          <Button img={off} text="Turn Off" onClick={onClickButton} />
          <Button
            style={{ margin: '-3px 0 0px 0', width: '33px', height: '33px' }}
            img={restart}
            text="Restart"
            onClick={onClickButton}
          />
        </>
      );
    }
    return (
      <>
        <Button
          img={switcher}
          text="Switch User"
          style={{ border: '1px solid #fff', borderRadius: '3px' }}
          onClick={onClickButton}
        />
        <Button img={lock} text="Log Off" onClick={onClickButton} />
      </>
    );
  }
  return (
    <div className="modal">
      <header className="header">
        <span className="header__text">Log Off Windows</span>
        <img src={windowsLogo} alt="" className="header__img" />
      </header>
      <div className="content">{renderButtons()}</div>
      <footer className="footer">
        <button onClick={onClose} className="footer__button">
          Cancel
        </button>
      </footer>
    </div>
  );
};
const Button = ({ style, img, text, onClick }) => {
  function _onClick() {
    onClick(text);
  }
  return (
    <div className="button-container">
      <img
        onClick={_onClick}
        style={{ ...style }}
        src={img}
        alt={text}
        className="button-img"
      />
      <span className="button-text">{text}</span>
    </div>
  );
};
const ButtonDisabled = ({ img, text }) => (
  <div className="button-container disable">
    <img src={img} alt={text} className="button-img" />
    <span className="button-text">{text}</span>
  </div>
);
const StyledContainer = styled(Container)`
  font-family: Tahoma, 'Noto Sans', sans-serif;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  .modal {
    margin-top: 30vh;
    width: 300px;
    height: 190px;
    border: 1px solid black;
    display: flex;
    flex-direction: column;
  }
  .header {
    height: 42px;
    display: flex;
    padding-left: 10px;
    align-items: center;
    background: #092178;
  }
  .header__text {
    font-size: 17px;
    font-family: 'Noto Sans';
    color: #fff;
    flex: 1;
  }
  .header__img {
    width: auto;
    height: 30px;
    margin-right: 5px;
  }
  .content {
    flex: 1;
    background: linear-gradient(
      to right,
      #3349e0 0%,
      #617ee6 47%,
      #617ee6 53%,
      #3349e0 100%
    );
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 0 30px;
    position: relative;
    &:before {
      content: '';
      display: block;
      position: absolute;
      height: 2px;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(
        to right,
        transparent 0,
        rgba(255, 255, 255, 0.3) 40%,
        rgba(255, 255, 255, 0.3) 60%,
        transparent 100%
      );
    }
  }
  .button-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #fff;
    &.disable {
      color: gray;
      .button-img {
        opacity: 0.3;
        &:hover {
          filter: none;
        }
        &:hover:active {
          filter: none;
        }
      }
    }
  }
  .button-img {
    height: 30px;
    width: 30px;
    &:hover {
      filter: brightness(1.1);
    }
    &:hover:active {
      filter: brightness(0.7);
    }
  }
  .button-text {
    padding-top: 3px;
    font-weight: bold;
    font-size: 11px;
  }
  .footer {
    height: 42px;
    background: #092178;
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }
  .footer__button {
    font-size: 11px;
    padding: 0 8px;
    line-height: 10px;
    background: rgb(240, 240, 240);
    margin-right: 10px;
    height: 16px;
    border-radius: 1px;
    box-shadow: 2px 2px 4px 1px #0005b0, 2px 2px 2px 0px white,
      inset 0 0 0 1px skyblue, inset 2px -2px skyblue;
    border: none;
    outline: none;
    &:hover {
      box-shadow: 1px 1px black, 1px 1px 2px 0px white, inset 0 0 0 1px orange,
        inset 2px -2px orange;
    }
    &:hover:active {
      box-shadow: none;
      background: rgb(220, 220, 220);
    }
  }
`;

export default Modal;
