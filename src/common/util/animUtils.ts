import { keyframes } from '@emotion/react';


export const animationColorBeamScatter = keyframes`
    100%, 0% {
        //color: rgb(183, 255, 0);
        color: rgb(219, 255, 77);
    }
    25% {
        //color: rgb(255, 251, 0);
        color: rgb(255, 255, 128);
    }
    50% {
        //color: rgba(0, 255, 81);
        color: rgba(128, 255, 153);
    }
    75% {
        //color: rgb(255, 153, 0);
        color: rgb(255, 204, 77);
    }`;


export const animationColorBeamGather = keyframes`
    100%, 0% {
        background-color: rgb(102, 0, 51);
    }
    25% {
        background-color: rgb(76, 0, 76);
    }
    50% {
        background-color: rgb(63, 0, 128);
    }
    75% {
        background-color: rgb(0, 0, 128);
    }`;


export const animationColorBlues = keyframes`
    0%, 100% {
        color: #636B74; /* Neutral main color (500) */
    }
    25% {
        color: #12467B; /* Primary darker shade (700) */
    }
    50% {
        color: #0B6BCB; /* Primary main color (500) */
    }
    75% {
        color: #083e75; /* Primary lighter shade (300) */
    }`;

export const animationColorRainbow = keyframes`
    100%, 0% {
        color: rgb(255, 0, 0);
    }
    8% {
        color: rgb(204, 102, 0);
    }
    16% {
        color: rgb(128, 128, 0);
    }
    25% {
        color: rgb(77, 153, 0);
    }
    33% {
        color: rgb(0, 179, 0);
    }
    41% {
        color: rgb(0, 153, 82);
    }
    50% {
        color: rgb(0, 128, 128);
    }
    58% {
        color: rgb(0, 102, 204);
    }
    66% {
        color: rgb(0, 0, 255);
    }
    75% {
        color: rgb(127, 0, 255);
    }
    83% {
        color: rgb(153, 0, 153);
    }
    91% {
        color: rgb(204, 0, 102);
    }`;

/*export const animationColorDarkerRainbow = keyframes`
    100%, 0% {
        background-color: rgb(128, 0, 0);
    }
    8% {
        background-color: rgb(102, 51, 0);
    }
    16% {
        background-color: rgb(64, 64, 0);
    }
    25% {
        background-color: rgb(38, 76, 0);
    }
    33% {
        background-color: rgb(0, 89, 0);
    }
    41% {
        background-color: rgb(0, 76, 41);
    }
    50% {
        background-color: rgb(0, 64, 64);
    }
    58% {
        background-color: rgb(0, 51, 102);
    }
    66% {
        background-color: rgb(0, 0, 128);
    }
    75% {
        background-color: rgb(63, 0, 128);
    }
    83% {
        background-color: rgb(76, 0, 76);
    }
    91% {
        background-color: rgb(102, 0, 51);
    }`;*/

export const animationEnterBelow = keyframes`
    from {
        opacity: 0;
        transform: translateY(8px)
    }
    to {
        opacity: 1;
        transform: translateY(0)
    }
`;

export const animationEnterScaleUp = keyframes`
    0% {
        opacity: 0;
        //transform: translateY(8px);
        scale: 0.98;
        //rotate: -5deg;
    }
    100% {
        opacity: 1;
        //transform: translateY(0);
        scale: 1;
        //rotate: 0;
    }`;

export const animationScalePulse = keyframes`
    0%, 100% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.2);
    }`;

/* // noinspection CssUnresolvedCustomProperty
const cssBackgroundFadeIn = keyframes`
    0% {
        background-color: transparent
    }
    100% {
        background-color: var(--joy-palette-background-backdrop)
    }`;*/

export const animationShadowLimey = keyframes`
    100%, 0% {
        //background-color: rgb(102, 0, 51);
        box-shadow: 1px 1px 0 white, 2px 2px 12px rgb(183, 255, 0);
    }
    25% {
        //background-color: rgb(76, 0, 76);
        box-shadow: 1px 1px 0 white, 2px 2px 12px rgb(255, 251, 0);
        //scale: 1.2;
    }
    50% {
        //background-color: rgb(63, 0, 128);
        box-shadow: 1px 1px 0 white, 2px 2px 12px rgba(0, 255, 81);
        //scale: 0.8;
    }
    75% {
        //background-color: rgb(0, 0, 128);
        box-shadow: 1px 1px 0 white, 2px 2px 12px rgb(255, 153, 0);
    }`;