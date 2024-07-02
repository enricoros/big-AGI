import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';

import risk from 'assets/windowsIcons/229(16x16).png';

function Balloon({ startAfter = 3000, duration = 15000 }) {
  const [show, setShow] = useState(true);
  const [start, setStart] = useState(false);
  useEffect(() => {
    const openTimer = setTimeout(() => setStart(true), startAfter);
    const fadeTimer = setTimeout(() => setShow(false), startAfter + duration);
    const closeTimer = setTimeout(
      () => setStart(false),
      startAfter + duration + 1000,
    );
    return () => {
      clearTimeout(openTimer);
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [startAfter, duration]);
  return (
    start && (
      <Div show={show}>
        <div className="balloon__container">
          <button onClick={() => setShow(false)} className="balloon__close" />
          <div className="balloon__header">
            <img className="balloon__header__img" src={risk} alt="risk" />
            <span className="balloon__header__text">
              Your computer might be at risk
            </span>
          </div>
          <p className="balloon__text__first">
            Antivirus software might not be installed
          </p>
          <p className="balloon__text__second">
            Click this balloon to fix this problem.
          </p>
        </div>
      </Div>
    )
  );
}
const fadein = keyframes`
  0% { 
    display: block;
    opacity: 0;
  }
  100% {
    display: block;
    opacity: 1;
  }
`;
const fadeout = keyframes`
  0% { 
    display: block;
    opacity: 1;
  }
  99% {
    display: block;
    opacity: 0;
  }
  100% {
    display: none;
    opacity: 0;
  }
`;
const Div = styled.div`
  position: absolute;
  display: block;
  opacity: 0;
  animation: ${({ show }) => (show ? fadein : fadeout)} 1s forwards;
  filter: drop-shadow(2px 2px 1px rgba(0, 0, 0, 0.4));
  .balloon__container {
    position: absolute;
    right: -4px;
    bottom: 19px;
    border: 1px solid black;
    border-radius: 7px;
    padding: 6px 28px 10px 10px;
    background-color: #ffffe1;
    font-size: 11px;
    white-space: nowrap;
    &:before {
      content: '';
      position: absolute;
      display: block;
      bottom: -19px;
      right: 14px;
      width: 0;
      height: 0;
      border-style: solid;
      border-width: 0 19px 19px 0;
      border-color: transparent black transparent transparent;
    }
    &:after {
      content: '';
      position: absolute;
      display: block;
      bottom: -17px;
      right: 15px;
      width: 0;
      height: 0;
      border-style: solid;
      border-width: 0 18px 18px 0;
      border-color: transparent #ffffe1 transparent transparent;
    }
  }
  .balloon__close:hover {
    background-color: #ffa90c;
    border-color: white;
    box-shadow: 1px 1px rgba(0, 0, 0, 0.1);
    &:before,
    &:after {
      background-color: white;
    }
  }
  .balloon__close {
    outline: none;
    position: absolute;
    right: 4px;
    top: 4px;
    width: 14px;
    height: 14px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 3px;
    background-color: transparent;
    &:before {
      content: '';
      position: absolute;
      left: 5px;
      top: 2px;
      transform: rotate(45deg);
      height: 8px;
      width: 2px;
      background-color: rgba(170, 170, 170);
    }
    &:after {
      content: '';
      position: absolute;
      left: 5px;
      top: 2px;
      transform: rotate(-45deg);
      height: 8px;
      width: 2px;
      background-color: rgba(170, 170, 170);
    }
  }
  .balloon__header {
    display: flex;
    align-items: center;
    font-weight: 700;
  }
  .balloon__header__img {
    width: 14px;
    height: 14px;
    margin-right: 8px;
  }
  .balloon__text__first {
    margin: 5px 0 10px;
  }
`;
export default Balloon;
