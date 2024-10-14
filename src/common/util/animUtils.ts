import { keyframes } from '@emotion/react';


// Color

export const animationColorBeamScatterINV = keyframes`
    100%, 0% {
        color: rgb(219, 255, 77);
    }
    25% {
        color: rgb(255, 255, 128);
    }
    50% {
        color: rgba(128, 255, 153);
    }
    75% {
        color: rgb(255, 204, 77);
    }`;

export const animationColorBeamScatter = keyframes`
    100%, 0% {
        color: rgb(85, 140, 47); // A rich, dark green
    }
    25% {
        color: rgb(75, 115, 35); // A slightly desaturated green for contrast
    }
    50% {
        color: rgba(65, 155, 55); // A brighter, more saturated green with slight transparency
    }
    75% {
        color: rgb(95, 130, 40); // A blend between the first and third colors for a smooth transition
    }`;

export const animationColorBeamGather = keyframes`
    100%, 0% {
        color: rgb(102, 0, 51);
    }
    25% {
        color: rgb(76, 0, 76);
    }
    50% {
        color: rgb(63, 0, 128);
    }
    75% {
        color: rgb(0, 0, 128);
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

/*export const animationColorLimey = keyframes`
    100%, 0% {
        color: rgb(183, 255, 0);
    }
    25% {
        color: rgb(255, 251, 0);
    }
    50% {
        color: rgba(0, 255, 81);
    }
    75% {
        color: rgb(255, 153, 0);
    }`;
*/


// Background-Color

export const animationBackgroundBeamGather = keyframes`
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

export const animationBackgroundCameraFlash = keyframes`
    15% {
        background-color: rgba(0, 0, 0, 1);
    }
    35% {
        background-color: rgba(255, 255, 255, 0.9);
    }
    100% {
        background-color: transparent;
    }
`;

/*export const animationBackgroundDarkerRainbow = keyframes`
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


// Transform

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

export const animationEnterModal = keyframes`
    from, 50%, to {
        animation-timing-function: cubic-bezier(.215, .61, .355, 1) // ease-out
    }
    0% {
        opacity: .91;
        transform: scale3d(.98, .98, .98)
    }
    70% {
        opacity: 1;
        transform: scale3d(1.04, 1.04, 1.04)
    }
    to {
        transform: none;
    }
`;

export const animationScalePulse = keyframes`
    0%, 100% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.2);
    }`;

export const animationEnterScaleUp = keyframes`
    0% {
        //opacity: 0;
        //transform: translateY(8px);
        scale: 0.98;
        //rotate: -5deg;
    }
    100% {
        //opacity: 1;
        //transform: translateY(0);
        scale: 1;
        //rotate: 0;
    }`;


// Box/Text Shadow

export const animationShadowRingLimey = keyframes`
    100%, 0% {
        box-shadow: 1px 1px 0 white, 2px 2px 12px rgb(183, 255, 0);
    }
    25% {
        box-shadow: 1px 1px 0 white, 2px 2px 12px rgb(255, 251, 0);
        //scale: 1.2;
    }
    50% {
        box-shadow: 1px 1px 0 white, 2px 2px 12px rgba(0, 255, 81);
        //scale: 0.8;
    }
    75% {
        box-shadow: 1px 1px 0 white, 2px 2px 12px rgb(255, 153, 0);
    }`;

export const animationShadowBerry = keyframes`
    100%, 0% {
        box-shadow: 2px 2px 12px rgb(102, 0, 51);
    }
    25% {
        box-shadow: 2px 2px 12px rgb(76, 0, 76);
    }
    50% {
        box-shadow: 2px 2px 12px rgb(63, 0, 128);
    }
    75% {
        box-shadow: 2px 2px 12px rgb(0, 0, 128);
    }`;

export const animationShadowLimey = keyframes`
    100%, 0% {
        box-shadow: 2px 2px 12px -6px rgb(183, 255, 0);
    }
    25% {
        box-shadow: 2px 2px 12px -6px rgb(255, 251, 0);
    }
    50% {
        box-shadow: 2px 2px 12px -6px rgba(0, 255, 81);
    }
    75% {
        box-shadow: 2px 2px 12px -6px rgb(255, 153, 0);
    }`;

export const animationTextShadowLimey = keyframes`
    100%, 0% {
        text-shadow: 2px 2px 0 rgba(183, 255, 0, 0.5);
    }
    25% {
        text-shadow: 2px 2px 0 rgba(255, 251, 0, 0.5);
    }
    50% {
        text-shadow: 2px 2px 0 rgba(0, 255, 81, 0.5);
    }
    75% {
        text-shadow: 2px 2px 0 rgba(255, 153, 0, 0.5);
    }`;

// export const animationShadowBlueDarker = keyframes`
//     0%, 100% {
//         box-shadow: 3px 3px 0 rgb(135, 206, 235), /* Sky Blue */ 6px 6px 0 rgb(70, 130, 180), /* Steel Blue */ 9px 9px 0 rgb(0, 128, 128); /* Teal */
//     }
//     25% {
//         box-shadow: 3px 3px 0 rgb(116, 172, 223), /* Softer Sky Blue */ 6px 6px 0 rgb(60, 120, 170), /* Softer Steel Blue */ 9px 9px 0 rgb(0, 118, 118); /* Softer Teal */
//     }
//     50% {
//         box-shadow: 3px 3px 0 rgb(100, 149, 237), /* Cornflower Blue */ 6px 6px 0 rgb(30, 144, 255), /* Dodger Blue */ 9px 9px 0 rgb(0, 206, 209); /* Dark Turquoise */
//     }
//     75% {
//         box-shadow: 3px 3px 0 rgb(65, 105, 225), /* Royal Blue */ 6px 6px 0 rgb(0, 0, 255), /* Blue */ 9px 9px 0 rgb(0, 139, 139); /* Dark Cyan */
//     }
// `;
//
// export const animationShadowLimeyDarker = keyframes`
//     0%, 100% {
//         box-shadow: 3px 3px 0 rgb(50, 205, 50), /* Lime Green */ 6px 6px 0 rgb(60, 179, 113), /* Medium Sea Green */ 9px 9px 0 rgb(34, 139, 34); /* Forest Green */
//     }
//     25% {
//         box-shadow: 3px 3px 0 rgb(124, 252, 0), /* Lawn Green */ 6px 6px 0 rgb(107, 142, 35), /* Olive Drab */ 9px 9px 0 rgb(85, 107, 47); /* Dark Olive Green */
//     }
//     50% {
//         box-shadow: 3px 3px 0 rgb(173, 255, 47), /* Green Yellow */ 6px 6px 0 rgb(154, 205, 50), /* Yellow Green */ 9px 9px 0 rgb(0, 100, 0); /* Dark Green */
//     }
//     75% {
//         box-shadow: 3px 3px 0 rgb(0, 255, 0), /* Lime */ 6px 6px 0 rgb(50, 205, 50), /* Lime Green */ 9px 9px 0 rgb(0, 128, 0); /* Green */
//     }
// `;
//
// export const blobMorph = keyframes`
//     0%, 100% {
//         border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
//     }
//     25% {
//         border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%;
//     }
//     50% {
//         border-radius: 30% 30% 70% 70% / 70% 70% 30% 30%;
//     }
//     75% {
//         border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%;
//     }
// `;
//
// export const bouncyBoxShadow = keyframes`
//     0% {
//         box-shadow: 0 8px 8px 0 rgba(11, 107, 203, 0.2);
//     }
//     20% {
//         box-shadow: 12px 20px 24px 0 rgba(11, 107, 203, 0.2);
//     }
//     40% {
//         box-shadow: -12px 32px 24px 0 rgba(11, 107, 203, 0.2);
//     }
//     60% {
//         box-shadow: 24px -4px 24px 0 rgba(11, 107, 203, 0.2);
//     }
//     80% {
//         box-shadow: -24px 14px 24px 0 rgba(11, 107, 203, 0.2);
//     }
//     100% {
//         box-shadow: 0 8px 8px 0 rgba(11, 107, 203, 0.2);
//     }
// `;