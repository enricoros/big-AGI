/**
 * Copyright (c) 2024 Enrico Ros
 *
 * A taste of the things to come.
 */

import React from 'react';

import { Box } from '@mui/joy';


// configuration
const SHOW_GRID = false;
const GRID_SIZE = 8;
const MAJOR_GRID_INTERVAL = 5;

const MAX_TOKENS = 30;
const TOKEN_CREATION_INTERVAL = 500;

// Original grayscale color palette
const colorPalette = ['#CDD7E1', '#9FA6AD', '#636B74', '#555E68', '#32383E'];
// const shapeOpacity = { min: 0.5, max: 0.9 };

// Additional vibrant colors to use occasionally
const specialColors = ['#FF6B6B', '#4ECDC4', '#45B7D1'];

const sizeVariation = { min: 0.6, max: 1 };
const speedVariation = {
  slow: { min: 20, max: 40 },
  fast: { min: 80, max: 120 },
} as const;

type ShapeType = typeof shapes[number];
const shapes = ['circle', 'rect', 'triangle'] as const;

type Token = {
  x: number;
  y: number;
  size: number;
  speed: number;
  type: ShapeType;
  color: string;
  // opacity: number;
  entryProgress: number;
};


export function DataStreamViz(props: { height: number, speed?: number }) {

  // state
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(document.createElement('canvas'));

  const animationRef = React.useRef<number>(0);
  const tokensRef = React.useRef<Token[]>([]);
  const lastTimeRef = React.useRef<number>(0);
  const lastTokenTimeRef = React.useRef<number>(0);

  // derived
  const dpr = window.devicePixelRatio || 1;
  const aliasOffset = dpr / 2;


  const setupCanvas = React.useCallback((canvas: HTMLCanvasElement, width: number, height: number) => {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.translate(aliasOffset, aliasOffset);
    ctx.scale(dpr, dpr);
    return ctx;
  }, [aliasOffset, dpr]);


  const createToken = React.useCallback((width: number, height: number) => {
    if (tokensRef.current.length >= MAX_TOKENS) return;
    if (Math.random() > 0.7) return; // Density variation

    const size = GRID_SIZE * (sizeVariation.min + Math.random() * (sizeVariation.max - sizeVariation.min));
    const yPosition = Math.floor(Math.random() * ((height - size) / GRID_SIZE)) * GRID_SIZE;

    // Decide whether to use a special color
    const useSpecialColor = Math.random() < 0.05; // 5% chance to use a special color
    const colorArray = useSpecialColor ? specialColors : colorPalette;
    const colorIndex = Math.floor(Math.random() * colorArray.length);

    const isFast = Math.random() > 0.7 || useSpecialColor; // 30% chance to be fast
    const speed =
      (props.speed || 1) * (
        isFast ? speedVariation.fast.min + Math.random() * (speedVariation.fast.max - speedVariation.fast.min)
          : speedVariation.slow.min + Math.random() * (speedVariation.slow.max - speedVariation.slow.min)
      ) / 1000;

    tokensRef.current.push({
      x: width + size, // Start off-screen
      y: yPosition,
      size: size,
      speed: speed,
      type: shapes[Math.floor(Math.random() * shapes.length)],
      color: colorArray[colorIndex],
      // opacity: useSpecialColor ? 1 : shapeOpacity.min + Math.random() * (shapeOpacity.max - shapeOpacity.min),
      entryProgress: 0,
    });
  }, [props.speed]);


  const drawGrid = React.useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.lineWidth = 0.5;

    ctx.strokeStyle = '#f0f0f0';
    for (let y = 0; y <= height; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    for (let x = 0; x <= width; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.strokeStyle = (x / GRID_SIZE) % MAJOR_GRID_INTERVAL === 0 ? '#e0e0e0' : '#f0f0f0';
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }, []);

  // Draw token function
  const drawToken = React.useCallback((ctx: CanvasRenderingContext2D, token: Token) => {
    ctx.fillStyle = /*token.entryProgress < 1 ? specialColors[Math.floor(Math.random() * colorPalette.length)] :*/ token.color;
    ctx.strokeStyle = token.color;
    ctx.lineWidth = 0.5;
    // ctx.globalAlpha = /* token.opacity * */ (token.entryProgress < 1 ? token.entryProgress : 1);

    const x = token.x; //  /* - 10 */ * token.size * (1 - token.entryProgress);

    switch (token.type) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(x + token.size / 2, token.y + token.size / 2, token.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'rect':
        ctx.fillRect(x, token.y, token.size, token.size);
        ctx.strokeRect(x, token.y, token.size, token.size);
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(x, token.y + token.size);
        ctx.lineTo(x + token.size / 2, token.y);
        ctx.lineTo(x + token.size, token.y + token.size);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
    }

    ctx.globalAlpha = 1;
  }, []);

  // Animation function
  const animate = React.useCallback((currentTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    if (!lastTimeRef.current) lastTimeRef.current = currentTime;
    const deltaTime = currentTime - lastTimeRef.current;

    ctx.clearRect(-1, -1, width + 2, height + 2);

    if (SHOW_GRID) drawGrid(ctx, width, height);

    if (currentTime - lastTokenTimeRef.current > TOKEN_CREATION_INTERVAL) {
      createToken(width, height);
      lastTokenTimeRef.current = currentTime;
    }

    for (let i = tokensRef.current.length - 1; i >= 0; i--) {
      const token = tokensRef.current[i];
      if (token.entryProgress < 1) {
        token.entryProgress += deltaTime / 300; // Adjust entry animation speed
        token.entryProgress = Math.min(token.entryProgress, 1); // Ensure it doesn't exceed 1
      }

      token.x -= token.speed * deltaTime;

      drawToken(ctx, token);

      if (token.x + token.size < 0) {
        tokensRef.current.splice(i, 1);
      }
    }

    lastTimeRef.current = currentTime;
    animationRef.current = requestAnimationFrame(animate);
  }, [createToken, drawGrid, drawToken]);


  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      const width = container.offsetWidth;
      const ctx = setupCanvas(canvasRef.current, width, props.height);
      ctx.clearRect(-1, -1, width + 2, props.height + 2);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [animate, props.height, setupCanvas]);


  return (
    <Box
      ref={containerRef}
      sx={{
        height: `${props.height}px`,
        overflow: 'hidden',
        position: 'relative',
        width: '100%', // Ensure the canvas fits horizontally
      }}
    >
      <canvas ref={canvasRef} />
    </Box>
  );
}
