/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Footprints, Ghost, Volume2, VolumeX, Play, RefreshCw, MessageSquareQuote } from 'lucide-react';

// --- Constants ---
const TILE_SIZE = 60;
const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 600;
const PLAYER_RADIUS = 15;
const BASE_SPEED = 2.0;
const RUN_SPEED = 4.5;
const NOISE_THRESHOLD = 50;

// --- Level Data (A shifting apartment/facility) ---
const INITIAL_MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,1,1,1,1,1,0,1,1,1,0,1],
  [1,0,1,0,0,0,0,0,1,0,0,0,0,1,0,1,0,0,0,1],
  [1,0,1,0,1,1,1,0,1,0,1,1,0,1,0,1,0,1,1,1],
  [1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
  [1,1,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
  [1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,0,1],
  [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,1],
  [1,0,1,0,1,1,1,1,1,1,1,1,1,1,0,1,0,1,0,1],
  [1,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
  [1,1,1,1,1,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const EXIT_POS = { x: 18, y: 1 };

type GameState = 'START' | 'PLAYING' | 'GAMEOVER' | 'VICTORY';
type Scene = 'ROOM' | 'HALL' | 'KITCHEN';

interface Entity {
  x: number;
  y: number;
  active: boolean;
  visible: boolean;
  type: 'STALKER' | 'SHADOW';
  lastSeen: number;
}

interface Prop {
  x: number;
  y: number;
  type: 'CHAIR' | 'DOOR' | 'NOTE' | 'BED' | 'FRIDGE' | 'SPROOT';
  originalX: number;
  originalY: number;
  moved: boolean;
  active?: boolean; 
  targetScene?: Scene;
}

const MAPS: Record<Scene, number[][]> = {
  ROOM: [
    [1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1],
  ],
  HALL: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  KITCHEN: [
    [1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1],
  ]
};

const SCENE_PROPS: Record<Scene, Prop[]> = {
  ROOM: [
    { x: 120, y: 120, type: 'BED', originalX: 120, originalY: 120, moved: false, active: true },
    { x: 540, y: 180, type: 'DOOR', originalX: 540, originalY: 180, moved: false, active: true, targetScene: 'HALL' },
  ],
  HALL: [
    { x: 60, y: 120, type: 'DOOR', originalX: 60, originalY: 120, moved: false, active: true, targetScene: 'ROOM' },
    { x: 900, y: 120, type: 'DOOR', originalX: 900, originalY: 120, moved: false, active: true, targetScene: 'KITCHEN' },
    { x: 300, y: 120, type: 'CHAIR', originalX: 300, originalY: 120, moved: false },
    { x: 600, y: 120, type: 'CHAIR', originalX: 600, originalY: 120, moved: false },
    { x: 450, y: 120, type: 'NOTE', originalX: 450, originalY: 120, moved: false }, // A small rug or note
  ],
  KITCHEN: [
    { x: 60, y: 120, type: 'DOOR', originalX: 60, originalY: 120, moved: false, active: true, targetScene: 'HALL' },
    { x: 480, y: 120, type: 'FRIDGE', originalX: 480, originalY: 120, moved: false, active: true },
    { x: 480, y: 120, type: 'SPROOT', originalX: 480, originalY: 120, moved: false, active: false }, // Hidden until fridge opened
  ]
};

// --- Main Component ---

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [panic, setPanic] = useState(0); // 0 to 100
  const [isMuted, setIsMuted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [noise, setNoise] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentScene, setCurrentScene] = useState<Scene>('ROOM');
  const [hasSproot, setHasSproot] = useState(false);
  const [objective, setObjective] = useState("Get some Sproot...");

  // Game Refs
  const playerRef = useRef({ x: 120, y: 180, angle: 0, lastX: 120, lastY: 180 });
  const entityRef = useRef<Entity>({ x: 0, y: 0, active: false, visible: false, type: 'STALKER', lastSeen: 0 });
  const propsRef = useRef<Prop[]>([...SCENE_PROPS.ROOM]);
  const inputRef = useRef<{ [key: string]: boolean }>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const flickerRef = useRef({ intensity: 1, nextFlicker: 0 });
  const mapRef = useRef(MAPS.ROOM.map(row => [...row]));

  // --- Audio Logic ---

  const playSound = (freq: number, type: OscillatorType = 'sine', duration = 0.5, volume = 0.1) => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.error("Audio failed", e);
    }
  };

  const playWhisper = () => {
    if (isMuted) return;
    const freqs = [200, 300, 150, 400];
    const freq = freqs[Math.floor(Math.random() * freqs.length)];
    playSound(freq, 'sine', 2, 0.01);
    playSound(freq + 5, 'sawtooth', 1.5, 0.005);
  };

  const playAmbientHum = () => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      // Base Hum
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(40 + (panic / 2), ctx.currentTime);
      gain.gain.setValueAtTime(0.02 + (panic / 1000), ctx.currentTime);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.1);

      // Scene Specific Hum
      if (currentScene === 'KITCHEN') {
        const kOsc = ctx.createOscillator();
        const kGain = ctx.createGain();
        kOsc.type = 'triangle';
        kOsc.frequency.setValueAtTime(60, ctx.currentTime);
        kGain.gain.setValueAtTime(0.01, ctx.currentTime);
        kOsc.connect(kGain);
        kGain.connect(ctx.destination);
        kOsc.start();
        kOsc.stop(ctx.currentTime + 0.1);
      }

      // Heartbeat
      if (panic > 60 || (entityRef.current.active && Math.hypot(playerRef.current.x - entityRef.current.x, playerRef.current.y - entityRef.current.y) < 200)) {
        if (Date.now() % 1000 < 100) {
          playSound(60, 'sine', 0.1, 0.05 + (panic / 500));
        }
        if (Date.now() % 1000 > 200 && Date.now() % 1000 < 300) {
          playSound(55, 'sine', 0.1, 0.03 + (panic / 500));
        }
      }
    } catch (e) {}
  };

  // --- Game Mechanics ---

  const isColliding = (x: number, y: number) => {
    const gridX = Math.floor(x / TILE_SIZE);
    const gridY = Math.floor(y / TILE_SIZE);
    if (gridY < 0 || gridY >= mapRef.current.length || gridX < 0 || gridX >= mapRef.current[0].length) return true;
    return mapRef.current[gridY][gridX] === 1;
  };

  const updateGame = useCallback(() => {
    if (gameState !== 'PLAYING') return;

    const player = playerRef.current;
    const running = inputRef.current['Shift'] || false;
    setIsRunning(running);
    const speed = running ? RUN_SPEED : BASE_SPEED;

    // 1. Player Movement
    let dx = 0;
    let dy = 0;
    if (inputRef.current['w'] || inputRef.current['ArrowUp']) dy -= speed;
    if (inputRef.current['s'] || inputRef.current['ArrowDown']) dy += speed;
    if (inputRef.current['a'] || inputRef.current['ArrowLeft']) dx -= speed;
    if (inputRef.current['d'] || inputRef.current['ArrowRight']) dx += speed;

    if (!isColliding(player.x + dx, player.y)) player.x += dx;
    if (!isColliding(player.x, player.y + dy)) player.y += dy;

    const moved = dx !== 0 || dy !== 0;
    if (moved) {
      player.angle = Math.atan2(dy, dx);
      if (running) {
        setPanic(prev => Math.min(100, prev + 0.3));
        setNoise(prev => Math.min(100, prev + 1.5));
      } else {
        setPanic(prev => Math.max(0, prev - 0.05));
        setNoise(prev => Math.max(0, prev - 0.5));
      }
    } else {
      setPanic(prev => Math.max(0, prev - 0.1));
      setNoise(prev => Math.max(0, prev - 0.8));
    }

    // 2. Flickering Lights & Environmental Shifts
    if (Date.now() > flickerRef.current.nextFlicker) {
      flickerRef.current.intensity = Math.random() > 0.85 ? 0.1 : 1;
      flickerRef.current.nextFlicker = Date.now() + (Math.random() * 3000);
      if (flickerRef.current.intensity < 1) {
        playSound(50, 'square', 0.1, 0.03);
        // Randomly shift a wall when lights flicker
        if (Math.random() > 0.7) {
          const rx = Math.floor(Math.random() * mapRef.current[0].length);
          const ry = Math.floor(Math.random() * mapRef.current.length);
          const distToPlayer = Math.hypot(player.x - rx * TILE_SIZE, player.y - ry * TILE_SIZE);
          if (distToPlayer > 200) {
            mapRef.current[ry][rx] = mapRef.current[ry][rx] === 1 ? 0 : 1;
          }
        }
      }
    }

    // 3. Psychological Manipulation (Props moving & Whispers)
    propsRef.current.forEach(prop => {
      const dist = Math.hypot(player.x - prop.x, player.y - prop.y);
      
      // Scene Transitions
      if (prop.type === 'DOOR' && dist < 40) {
        const nextScene = prop.targetScene!;
        setCurrentScene(nextScene);
        mapRef.current = MAPS[nextScene].map(row => [...row]);
        propsRef.current = [...SCENE_PROPS[nextScene]];
        
        // Position player relative to the door they just entered
        if (nextScene === 'HALL') {
          player.x = currentScene === 'ROOM' ? 120 : 840;
          player.y = 120;
        } else if (nextScene === 'ROOM') {
          player.x = 480;
          player.y = 180;
        } else if (nextScene === 'KITCHEN') {
          player.x = 120;
          player.y = 120;
        }
        
        playSound(200, 'square', 0.3, 0.05);
        return;
      }

      // Fridge Interaction
      if (prop.type === 'FRIDGE' && dist < 50 && !hasSproot) {
        setHasSproot(true);
        setObjective("Return to bed...");
        setMessage("Got the Sproot. Grass flavored. Refreshing.");
        setTimeout(() => setMessage(null), 3000);
        playSound(600, 'sine', 0.5, 0.05);
        // Find and hide the Sproot prop if it exists
        const sproot = propsRef.current.find(p => p.type === 'SPROOT');
        if (sproot) sproot.active = false;
      }

      // Bed Interaction
      if (prop.type === 'BED' && dist < 50 && hasSproot) {
        setGameState('VICTORY');
      }

      // Shifting Props (Subtle)
      if (prop.type === 'CHAIR' && dist > 350 && Math.random() < 0.002) {
        prop.x = prop.originalX + (Math.random() * 60 - 30);
        prop.y = prop.originalY + (Math.random() * 60 - 30);
        prop.moved = true;
      }
    });

    if (Math.random() < 0.0003 + (panic / 50000)) {
      playWhisper();
    }

    // 4. Entity Behavior (Unpredictable & Noise Sensitive)
    const entity = entityRef.current;
    // "Don't wake the echoes" - noise significantly increases spawn chance
    const spawnChance = 0.001 + (panic / 10000) + (noise > NOISE_THRESHOLD ? (noise - NOISE_THRESHOLD) / 1000 : 0);
    
    if (!entity.active && Math.random() < spawnChance) {
      entity.active = true;
      const spawnDist = 350 + Math.random() * 250;
      const spawnAngle = Math.random() * Math.PI * 2;
      entity.x = player.x + Math.cos(spawnAngle) * spawnDist;
      entity.y = player.y + Math.sin(spawnAngle) * spawnDist;
      entity.type = Math.random() > 0.7 ? 'STALKER' : 'SHADOW';
      entity.lastSeen = Date.now();
      
      if (noise > NOISE_THRESHOLD) {
        playSound(100, 'sawtooth', 0.5, 0.02); // Warning sound
      }
    }

    if (entity.active) {
      const distToPlayer = Math.hypot(player.x - entity.x, player.y - entity.y);
      
      if (entity.type === 'STALKER') {
        const targetAngle = Math.atan2(player.y - entity.y, player.x - entity.x);
        // Erratic movement
        const jitter = Math.sin(Date.now() / 200) * 0.5;
        const stalkerSpeed = 1.2 + (noise / 50);
        entity.x += Math.cos(targetAngle + jitter) * stalkerSpeed;
        entity.y += Math.sin(targetAngle + jitter) * stalkerSpeed;
        
        if (distToPlayer < 25) setGameState('GAMEOVER');
      } else {
        if (distToPlayer < 120) {
          entity.active = false;
          playSound(80, 'sine', 1.5, 0.04);
          setPanic(prev => Math.min(100, prev + 10));
        }
      }

      if (distToPlayer > 700) entity.active = false;
    }

    // 5. Random Messages & Echoes
    if (!message && Math.random() < 0.0005) {
      const messages = [
        "Are you sure you're alone?",
        "The walls remember.",
        "Don't look back.",
        "It's just a dream.",
        "Why are you still here?",
        "The Sproot calls.",
        "Silence is a lie.",
      ];
      setMessage(messages[Math.floor(Math.random() * messages.length)]);
      setTimeout(() => setMessage(null), 3000);
    }

    // Subtle "echo" sounds when noise is high
    if (noise > 30 && Math.random() < 0.005) {
      playSound(Math.random() * 100 + 50, 'sine', 1, 0.005);
    }

    playAmbientHum();
  }, [gameState, panic, message]);

  // --- Rendering ---

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
      const player = playerRef.current;

      // Camera logic
      const camX = Math.max(0, Math.min(player.x - VIEWPORT_WIDTH / 2, mapRef.current[0].length * TILE_SIZE - VIEWPORT_WIDTH));
      const camY = Math.max(0, Math.min(player.y - VIEWPORT_HEIGHT / 2, mapRef.current.length * TILE_SIZE - VIEWPORT_HEIGHT));

      ctx.save();
      ctx.translate(-camX, -camY);

      // Draw Map
      ctx.fillStyle = '#111';
      for (let y = 0; y < mapRef.current.length; y++) {
        for (let x = 0; x < mapRef.current[0].length; x++) {
          if (mapRef.current[y][x] === 1) {
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }

      // Draw Props
      propsRef.current.forEach(prop => {
        if (prop.type === 'DOOR') {
          ctx.fillStyle = '#222';
          ctx.fillRect(prop.x - 20, prop.y - 30, 40, 60);
          ctx.strokeStyle = '#444';
          ctx.strokeRect(prop.x - 20, prop.y - 30, 40, 60);
          // Door handle
          ctx.fillStyle = '#666';
          ctx.beginPath();
          ctx.arc(prop.x + 10, prop.y, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (prop.type === 'BED') {
          ctx.fillStyle = '#334';
          ctx.fillRect(prop.x - 40, prop.y - 60, 80, 120);
          ctx.fillStyle = '#556';
          ctx.fillRect(prop.x - 40, prop.y - 60, 80, 30); // Pillow
          // Blanket detail
          ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          ctx.beginPath();
          ctx.moveTo(prop.x - 40, prop.y - 10);
          ctx.lineTo(prop.x + 40, prop.y - 10);
          ctx.stroke();
        } else if (prop.type === 'FRIDGE') {
          ctx.fillStyle = '#eee';
          ctx.fillRect(prop.x - 25, prop.y - 40, 50, 80);
          ctx.fillStyle = '#ccc';
          ctx.fillRect(prop.x + 15, prop.y - 10, 5, 20); // Handle
          // Vent/Grill at bottom
          ctx.fillStyle = '#bbb';
          ctx.fillRect(prop.x - 20, prop.y + 30, 40, 2);
          ctx.fillRect(prop.x - 20, prop.y + 34, 40, 2);
        } else if (prop.type === 'SPROOT') {
          if (!hasSproot) {
            ctx.fillStyle = '#2d5a27'; // Dark green
            ctx.fillRect(prop.x - 5, prop.y - 8, 10, 16);
            ctx.fillStyle = '#c0c0c0';
            ctx.fillRect(prop.x - 5, prop.y - 8, 10, 2); // Top
          }
        } else if (prop.type === 'NOTE') {
          ctx.fillStyle = '#332211'; // Small rug
          ctx.fillRect(prop.x - 40, prop.y - 20, 80, 40);
        } else if (prop.type === 'CHAIR') {
          ctx.fillStyle = '#222';
          ctx.fillRect(prop.x - 10, prop.y - 10, 20, 20);
        }
      });

      // Draw Entity
      const entity = entityRef.current;
      if (entity.active) {
        ctx.fillStyle = entity.type === 'STALKER' ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.arc(entity.x, entity.y, 15, 0, Math.PI * 2);
        ctx.fill();
        // Glowing eyes for stalker
        if (entity.type === 'STALKER') {
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.beginPath();
          ctx.arc(entity.x - 5, entity.y - 2, 2, 0, Math.PI * 2);
          ctx.arc(entity.x + 5, entity.y - 2, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Player
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Draw Sproot in hand
      if (hasSproot) {
        ctx.fillStyle = '#2d5a27';
        const offsetAngle = player.angle + Math.PI / 4;
        const sprootX = player.x + Math.cos(offsetAngle) * 12;
        const sprootY = player.y + Math.sin(offsetAngle) * 12;
        ctx.fillRect(sprootX - 4, sprootY - 6, 8, 12);
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(sprootX - 4, sprootY - 6, 8, 2);
      }

      // --- Fog & Lighting ---
      const darknessCanvas = document.createElement('canvas');
      darknessCanvas.width = VIEWPORT_WIDTH;
      darknessCanvas.height = VIEWPORT_HEIGHT;
      const dctx = darknessCanvas.getContext('2d')!;

      // Global Fog (Scene specific)
      const fogColor = currentScene === 'KITCHEN' ? 'rgba(25, 35, 25, ' : currentScene === 'HALL' ? 'rgba(20, 20, 25, ' : 'rgba(30, 30, 35, ';
      dctx.fillStyle = `${fogColor}${0.85 * flickerRef.current.intensity})`;
      dctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

      // Flashlight (Relative to camera)
      dctx.globalCompositeOperation = 'destination-out';
      const beamLength = 280;
      const beamWidth = Math.PI / 2.2;
      const grad = dctx.createRadialGradient(player.x - camX, player.y - camY, 0, player.x - camX, player.y - camY, beamLength);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      dctx.fillStyle = grad;
      dctx.beginPath();
      dctx.moveTo(player.x - camX, player.y - camY);
      dctx.arc(player.x - camX, player.y - camY, beamLength, player.angle - beamWidth / 2, player.angle + beamWidth / 2);
      dctx.closePath();
      dctx.fill();

      // Ambient light around player
      const ambientGrad = dctx.createRadialGradient(player.x - camX, player.y - camY, 0, player.x - camX, player.y - camY, 80);
      ambientGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      ambientGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      dctx.fillStyle = ambientGrad;
      dctx.beginPath();
      dctx.arc(player.x - camX, player.y - camY, 80, 0, Math.PI * 2);
      dctx.fill();

      ctx.restore();
      ctx.drawImage(darknessCanvas, 0, 0);

      // Visual Glitches (based on panic)
      if (panic > 50 && Math.random() < panic / 500) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(Math.random() * VIEWPORT_WIDTH, Math.random() * VIEWPORT_HEIGHT, Math.random() * 100, 2);
      }
    };

    const loop = () => {
      updateGame();
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, updateGame, panic]);

  // --- Input Handlers ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { inputRef.current[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { inputRef.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const resetGame = () => {
    playerRef.current = { x: 120, y: 180, angle: 0, lastX: 120, lastY: 180 };
    entityRef.current = { x: 0, y: 0, active: false, visible: false, type: 'STALKER', lastSeen: 0 };
    setPanic(0);
    setNoise(0);
    setHasSproot(false);
    setCurrentScene('ROOM');
    setObjective("Get some Sproot...");
    setGameState('PLAYING');
    setMessage(null);
    mapRef.current = MAPS.ROOM.map(row => [...row]);
    propsRef.current = [...SCENE_PROPS.ROOM];
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-400 font-serif flex flex-col items-center justify-center overflow-hidden">
      {/* HUD - Minimalist */}
      <div className="z-10 w-full max-w-[800px] flex justify-between items-center mb-4 px-4 opacity-40 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Footprints className={`w-4 h-4 ${isRunning ? 'text-red-900 animate-pulse' : 'text-gray-600'}`} />
            <span className="text-[10px] uppercase tracking-[0.3em]">{isRunning ? 'Running' : 'Walking'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Volume2 className={`w-4 h-4 ${noise > NOISE_THRESHOLD ? 'text-red-900 animate-bounce' : 'text-gray-600'}`} />
            <div className="w-24 h-[1px] bg-gray-800">
              <div 
                className="h-full bg-blue-900/40 transition-all duration-300"
                style={{ width: `${noise}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${hasSproot ? 'text-green-500 animate-spin-slow' : 'text-gray-600'}`} />
            <span className={`text-[10px] uppercase tracking-[0.3em] ${hasSproot ? 'text-green-400' : ''}`}>{objective}</span>
            {hasSproot && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-3 h-5 bg-green-900 border border-green-500 rounded-sm ml-2"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Eye className={`w-4 h-4 ${panic > 70 ? 'text-red-900' : 'text-gray-600'}`} />
            <div className="w-24 h-[1px] bg-gray-800">
              <div 
                className="h-full bg-red-900 transition-all duration-500"
                style={{ width: `${panic}%` }}
              />
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => setIsMuted(!isMuted)}
          className="p-2 hover:text-white transition-colors"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Game Stage */}
      <div className="relative border border-white/5 rounded-sm shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden">
        <canvas 
          ref={canvasRef}
          width={VIEWPORT_WIDTH}
          height={VIEWPORT_HEIGHT}
          className="bg-black cursor-none"
        />

        {/* Cryptic Messages */}
        <AnimatePresence>
          {message && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="flex items-center gap-3 text-white/20 italic text-xl font-light">
                <MessageSquareQuote className="w-5 h-5" />
                {message}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* UI Overlays */}
        <AnimatePresence>
          {gameState === 'START' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center text-center p-12"
            >
              <h1 className="text-5xl font-light tracking-[0.5em] mb-4 text-gray-200 uppercase">
                3:00 AM
              </h1>
              <p className="text-gray-600 mb-12 max-w-lg text-sm italic leading-relaxed">
                "Thirst is a heavy burden in the dead of night."
                <br /><br />
                The house feels different at this hour. 
                Get your Sproot grass-flavored soda and return to bed.
                Don't wake the echoes.
              </p>
              
              <div className="flex gap-12 mb-12 text-left opacity-40">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-white">Movement</p>
                  <p className="text-xs">WASD / Arrows</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-white">Panic</p>
                  <p className="text-xs">Shift to Run</p>
                </div>
              </div>

              <button 
                onClick={() => setGameState('PLAYING')}
                className="group relative px-12 py-4 text-xs uppercase tracking-[0.4em] text-gray-400 hover:text-white transition-all"
              >
                <span className="absolute inset-0 border border-white/10 group-hover:border-white/30 transition-colors" />
                Step into the void
              </button>
            </motion.div>
          )}

          {gameState === 'GAMEOVER' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black flex flex-col items-center justify-center text-center"
            >
              <Ghost className="w-12 h-12 text-red-900/40 mb-6" />
              <h2 className="text-3xl font-light tracking-[0.3em] mb-2 text-gray-400 uppercase">Lost in the Echo</h2>
              <p className="text-gray-700 mb-8 text-xs italic">"Memory is a deceptive mirror."</p>
              <button 
                onClick={resetGame}
                className="text-[10px] uppercase tracking-[0.4em] text-gray-500 hover:text-white transition-all"
              >
                Return
              </button>
            </motion.div>
          )}

          {gameState === 'VICTORY' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center text-center text-black"
            >
              <h2 className="text-4xl font-light tracking-[0.5em] mb-4 uppercase text-black">Satisfied</h2>
              <p className="text-gray-600 mb-12 max-w-md text-sm italic leading-relaxed">
                "The Sproot was worth it. The night is quiet again. For now."
              </p>
              <button 
                onClick={resetGame}
                className="px-12 py-4 border border-black/20 text-[10px] uppercase tracking-[0.4em] hover:bg-black hover:text-white transition-all"
              >
                Sleep
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Noise/Grain Effect */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      {/* Footer Instructions */}
      <div className="mt-8 flex flex-col items-center gap-2 opacity-20">
        <div className="flex gap-8 text-[9px] uppercase tracking-[0.4em]">
          <span>Listen to the silence</span>
          <span>•</span>
          <span>Don't trust your eyes</span>
          <span>•</span>
          <span>The exit is within</span>
        </div>
      </div>
    </div>
  );
}
