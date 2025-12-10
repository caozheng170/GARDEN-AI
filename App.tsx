
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, FaceLandmarker, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';
import ControlPanel from './components/ControlPanel';
import { FlowerSpecies, PlantConfig, Seed, Plant, Particle, InteractionState } from './types';
import { drawSeed, drawPlant, drawParticle } from './utils/drawing';

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  
  // Updated Config State (No themeColor)
  const [config, setConfig] = useState<PlantConfig>({
    selectedSpecies: 'Random',
    growthHeightFactor: 1.0, // Default to 100% height
  });

  // HUD Refs
  const pinchBarRef = useRef<HTMLDivElement>(null);
  const pinchTextRef = useRef<HTMLSpanElement>(null);
  const growthBarRef = useRef<HTMLDivElement>(null);
  const growthTextRef = useRef<HTMLSpanElement>(null);
  const clearBarRef = useRef<HTMLDivElement>(null);
  const clearTextRef = useRef<HTMLSpanElement>(null);
  const clearContainerRef = useRef<HTMLDivElement>(null);

  // Simulation State Refs
  const seedsRef = useRef<Seed[]>([]);
  const plantsRef = useRef<Plant[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const interactionRef = useRef<InteractionState>({
    isPinching: false,
    pinchLocation: null,
    pinchProximity: 0,
    mouthOpenness: 0,
    isPalmOpen: false, // Updated from isFistClenched
    clearTimer: 0,     // Updated from fistTimer
  });
  
  // Vision Models
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // Debounce logic for pinch
  const pinchCooldownRef = useRef(0);

  // Ref for config to be accessed inside requestAnimationFrame loop
  const configRef = useRef(config);
  
  // Handle keyboard shortcut 'H' to toggle controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') {
        setShowControls(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Update ref when config changes and trigger side effects (update existing plants)
  useEffect(() => {
    configRef.current = config;
    
    // Immediate Update Logic:
    // If a specific species is selected (not Random), transform all existing plants to that species.
    if (config.selectedSpecies !== 'Random') {
      const targetSpecies = config.selectedSpecies as FlowerSpecies;
      plantsRef.current.forEach(plant => {
        plant.species = targetSpecies;
        // Update color based on new species to ensure consistency
        plant.color = getSpeciesColor(targetSpecies);
      });
      // Also update seeds that haven't landed yet
      seedsRef.current.forEach(seed => {
        seed.species = targetSpecies;
        seed.color = getSpeciesColor(targetSpecies);
      });
    }
  }, [config]);

  const handleConfigChange = (newConfig: PlantConfig) => {
    setConfig(newConfig);
  };

  useEffect(() => {
    let active = true;

    const initVision = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        if (!active) return;

        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });

        if (!active) return;

        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });

        if (active) startCamera();
      } catch (error) {
        console.error("Error loading vision models:", error);
      }
    };

    initVision();

    return () => {
      active = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      // Cleanup camera tracks
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: "user" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Robustly handle video loading
        if (videoRef.current.readyState >= 2) {
          setLoading(false);
          predictWebcam();
        } else {
          videoRef.current.onloadeddata = () => {
             setLoading(false);
             predictWebcam();
          };
        }
      }
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  };

  const predictWebcam = () => {
    // Always schedule the next frame first to prevent the loop from dying if we return early
    requestRef.current = requestAnimationFrame(predictWebcam);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // If models or elements aren't ready, just return and try again next frame
    if (!video || !canvas || !faceLandmarkerRef.current || !handLandmarkerRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // 1. Vision Processing
    if (video.currentTime !== lastVideoTimeRef.current && video.readyState >= 2) {
      lastVideoTimeRef.current = video.currentTime;
      try {
        const faceResult = faceLandmarkerRef.current.detectForVideo(video, currentTime);
        const handResult = handLandmarkerRef.current.detectForVideo(video, currentTime);
        processInteraction(faceResult, handResult, canvas.width, canvas.height, deltaTime);
      } catch (e) {
        console.warn("Detection error (skipping frame):", e);
      }
    }

    // 2. Physics & Rendering
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawSpatialIndicators(ctx);
    updateHUD();

    updateSeeds(canvas.height);
    seedsRef.current.forEach(seed => drawSeed(ctx, seed));
    
    updateParticles();
    particlesRef.current.forEach(p => drawParticle(ctx, p));

    updatePlants(deltaTime);
    
    // Draw plants with current global height factor from ref
    const currentHeightFactor = configRef.current.growthHeightFactor;
    plantsRef.current.forEach(plant => drawPlant(ctx, plant, currentHeightFactor));
  };

  const processInteraction = (faceResult: any, handResult: any, width: number, height: number, deltaTime: number) => {
    const state = interactionRef.current;

    // --- FACE: Mouth Openness ---
    if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
      const landmarks = faceResult.faceLandmarks[0];
      const upperLip = landmarks[13];
      const lowerLip = landmarks[14];
      const faceTop = landmarks[10];
      const faceBottom = landmarks[152];
      const faceHeight = Math.abs(faceTop.y - faceBottom.y);

      const mouthDist = Math.abs(upperLip.y - lowerLip.y);
      const normalizedOpenness = Math.min(Math.max((mouthDist / faceHeight) - 0.02, 0) * 10, 1);
      
      state.mouthOpenness = normalizedOpenness;
    } else {
      state.mouthOpenness = 0;
    }

    // --- HANDS Logic ---
    state.isPinching = false;
    let anyPalmOpenDetected = false;
    let maxPinchProximity = 0;

    if (handResult.landmarks) {
      // Pass 1: Check for Open Hand (5 Fingers Extended) across all detected hands
      for (const landmarks of handResult.landmarks) {
         // Logic: A finger is open if tip is farther from wrist than the joint before it
         // Landmarks: 0=Wrist, 4=ThumbTip, 8=IndexTip...
         // Comparison: Tip vs MCP(joint near palm) usually reliable
         const isTipFartherThanJoint = (tipIdx: number, jointIdx: number) => {
            const dTip = Math.hypot(landmarks[tipIdx].x - landmarks[0].x, landmarks[tipIdx].y - landmarks[0].y);
            const dJoint = Math.hypot(landmarks[jointIdx].x - landmarks[0].x, landmarks[jointIdx].y - landmarks[0].y);
            return dTip > dJoint;
         };

         // Thumb(4 vs 2), Index(8 vs 5), Middle(12 vs 9), Ring(16 vs 13), Pinky(20 vs 17)
         // Using MCP (5,9,13,17) for fingers, MCP(2) for thumb
         if (
             isTipFartherThanJoint(4, 2) && 
             isTipFartherThanJoint(8, 5) && 
             isTipFartherThanJoint(12, 9) && 
             isTipFartherThanJoint(16, 13) && 
             isTipFartherThanJoint(20, 17)
         ) {
           anyPalmOpenDetected = true;
         }
      }

      // Pass 2: Check for Pinch (Only if NO Open Hand is detected)
      if (!anyPalmOpenDetected) {
        for (const landmarks of handResult.landmarks) {
          const thumbTip = landmarks[4];
          const indexTip = landmarks[8];
          const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

          const proximity = Math.max(0, Math.min(1, (0.15 - pinchDist) / (0.15 - 0.05)));
          if (proximity > maxPinchProximity) maxPinchProximity = proximity;

          if (pinchDist < 0.05) {
            state.isPinching = true;
            state.pinchLocation = { x: indexTip.x * width, y: indexTip.y * height };
            
            if (pinchCooldownRef.current <= 0) {
              spawnSeed(state.pinchLocation);
              pinchCooldownRef.current = 500;
            }
          }
        }
      }
    }
    
    state.pinchProximity = maxPinchProximity;

    if (pinchCooldownRef.current > 0) pinchCooldownRef.current -= deltaTime;

    // --- CLEAR TIMER (using Palm Open detection) ---
    if (anyPalmOpenDetected) {
      state.isPalmOpen = true;
      state.clearTimer += deltaTime;
      if (state.clearTimer > 5000) {
        explodePlants();
        state.clearTimer = 0;
      }
    } else {
      state.isPalmOpen = false;
      state.clearTimer = Math.max(0, state.clearTimer - deltaTime * 2);
    }
  };

  // Helper to determine natural color
  const getSpeciesColor = (species: FlowerSpecies): string => {
    switch(species) {
      case FlowerSpecies.Rose: return '#e11d48'; // Red-600
      case FlowerSpecies.Tulip: return '#a855f7'; // Purple-500
      case FlowerSpecies.WildChrysanthemum: return '#facc15'; // Yellow-400
      case FlowerSpecies.Sunflower: return '#f59e0b'; // Amber-500
      case FlowerSpecies.Dandelion: return '#cbd5e1'; // Slate-300
      default: return '#eab308';
    }
  };

  const spawnSeed = (loc: {x: number, y: number}) => {
    let species = FlowerSpecies.Rose; // Fallback
    const currentConfig = configRef.current;

    if (currentConfig.selectedSpecies === 'Random') {
      const allSpecies = Object.values(FlowerSpecies);
      species = allSpecies[Math.floor(Math.random() * allSpecies.length)];
    } else {
      species = currentConfig.selectedSpecies as FlowerSpecies;
    }

    seedsRef.current.push({
      id: Math.random().toString(36),
      x: loc.x,
      y: loc.y,
      vy: 5,
      species: species,
      color: getSpeciesColor(species),
      isLanded: false
    });
  };

  const updateSeeds = (groundLevel: number) => {
    seedsRef.current.forEach(seed => {
      if (!seed.isLanded) {
        seed.y += seed.vy;
        seed.vy += 0.5;
        
        if (seed.y >= groundLevel - 20) {
          seed.y = groundLevel - 20;
          seed.isLanded = true;
          plantsRef.current.push({
            id: seed.id,
            x: seed.x,
            y: seed.y,
            height: 0,
            maxHeight: 200 + Math.random() * 150,
            growthProgress: 0,
            species: seed.species,
            color: seed.color,
            seed: Math.random() * 100,
            stemControlPoints: []
          });
        }
      }
    });
    seedsRef.current = seedsRef.current.filter(s => !s.isLanded);
  };
  
  const updateParticles = () => {
    particlesRef.current.forEach(p => {
       p.x += p.vx;
       p.y += p.vy;
       p.vy += 0.2; // Gravity
       p.life -= 0.02; // Fade out
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
  };

  const updatePlants = (deltaTime: number) => {
    const growthSpeed = 7.5; // Increased speed by 50%
    const growthInput = (interactionRef.current.mouthOpenness * 0.001 * growthSpeed);
    
    plantsRef.current.forEach(plant => {
      if (interactionRef.current.mouthOpenness > 0.05) {
        if (plant.growthProgress < 1) {
          plant.growthProgress += growthInput;
          if (plant.growthProgress > 1) plant.growthProgress = 1;
        }
      }
    });
  };

  const explodePlants = () => {
    // Create explosion effects for all plants
    const currentHeightFactor = configRef.current.growthHeightFactor;
    
    plantsRef.current.forEach(plant => {
      const effectiveHeight = plant.maxHeight * plant.growthProgress * currentHeightFactor;
      // Calculate flower head position
      const headX = plant.x + (Math.cos(plant.seed) * 10);
      const headY = plant.y - effectiveHeight;

      // Burst count
      const particleCount = 20;
      for(let i=0; i<particleCount; i++) {
        const speed = Math.random() * 8 + 2;
        const angle = Math.random() * Math.PI * 2;
        
        particlesRef.current.push({
          id: Math.random().toString(),
          x: headX,
          y: headY,
          vx: Math.cos(angle) * (Math.random() * 5),
          vy: Math.sin(angle) * (Math.random() * 5) - 5, // Initial upward burst
          color: plant.color,
          life: 1.0,
          size: Math.random() * 5 + 2
        });
      }
      
      // Add some green particles for stems
      for(let i=0; i<10; i++) {
         particlesRef.current.push({
          id: Math.random().toString(),
          x: plant.x,
          y: plant.y - (effectiveHeight / 2),
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          color: '#22c55e',
          life: 1.0,
          size: Math.random() * 3 + 1
        });
      }
    });

    plantsRef.current = [];
    seedsRef.current = [];
  };

  const drawSpatialIndicators = (ctx: CanvasRenderingContext2D) => {
    const state = interactionRef.current;
    if (state.isPinching && state.pinchLocation) {
      ctx.beginPath();
      ctx.arc(state.pinchLocation.x, state.pinchLocation.y, 20, 0, Math.PI * 2);
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  };

  const updateHUD = () => {
    const state = interactionRef.current;

    // Pinch Bar
    if (pinchBarRef.current && pinchTextRef.current) {
      // If palm is open, show restricted state
      if (state.isPalmOpen) {
         pinchBarRef.current.style.width = '0%';
         pinchBarRef.current.style.backgroundColor = '#64748b'; // Slate-500
         pinchTextRef.current.innerText = '无法播种 (Palm Open)';
         pinchTextRef.current.style.color = '#64748b';
      } else {
        const pinchPercent = state.pinchProximity * 100;
        pinchBarRef.current.style.width = `${pinchPercent}%`;
        
        if (state.isPinching) {
          pinchBarRef.current.style.backgroundColor = '#22c55e';
          pinchTextRef.current.innerText = '已播种!';
          pinchTextRef.current.style.color = '#22c55e';
        } else {
          pinchBarRef.current.style.backgroundColor = '#06b6d4';
          pinchTextRef.current.innerText = pinchPercent > 10 ? '捏合手指...' : '等待中';
          pinchTextRef.current.style.color = '#06b6d4';
        }
      }
    }

    // Growth Bar
    if (growthBarRef.current && growthTextRef.current) {
      const growthPercent = Math.min(state.mouthOpenness * 100, 100);
      growthBarRef.current.style.width = `${growthPercent}%`;
      growthTextRef.current.innerText = `${growthPercent.toFixed(0)}%`;
    }

    // Clear Bar (Updated logic for open hand)
    if (clearBarRef.current && clearTextRef.current && clearContainerRef.current) {
      const clearPercent = Math.min((state.clearTimer / 5000) * 100, 100);
      clearBarRef.current.style.width = `${clearPercent}%`;
      clearTextRef.current.innerText = `${(state.clearTimer / 1000).toFixed(1)}s`;
      
      if (state.isPalmOpen) {
        clearContainerRef.current.style.borderColor = `rgba(239, 68, 68, ${0.3 + clearPercent/200})`;
        if (clearPercent >= 100) {
           clearTextRef.current.innerText = "已粉碎!";
        }
      } else {
        clearContainerRef.current.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      }
    }
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden flex items-center justify-center">
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500 mb-4"></div>
          <p className="text-xl">正在初始化自然引擎...</p>
          <p className="text-sm text-gray-400 mt-2">请允许摄像头权限</p>
        </div>
      )}

      <video 
        ref={videoRef}
        className="absolute w-full h-full object-cover transform -scale-x-100"
        autoPlay
        playsInline
        muted
      />

      <canvas 
        ref={canvasRef}
        className="absolute w-full h-full object-cover transform -scale-x-100"
      />

      {/* Top Left Status HUD */}
      <div className="absolute top-4 left-4 z-20 w-64 space-y-3 font-sans select-none pointer-events-none">
        
        {/* Pinch */}
        <div className="bg-black/60 backdrop-blur-md rounded-lg p-3 border border-white/10 transition-colors">
          <div className="flex justify-between items-center mb-1">
            <div className="text-xs font-bold text-gray-300 uppercase flex items-center gap-1">
              <span>🤏</span> 播种 (Pinch)
            </div>
            <span ref={pinchTextRef} className="text-xs font-mono text-cyan-400">等待中</span>
          </div>
          <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
            <div ref={pinchBarRef} className="h-full bg-cyan-400 w-0 transition-all duration-75 ease-out shadow-[0_0_10px_rgba(34,211,238,0.5)]"></div>
          </div>
        </div>

        {/* Growth */}
        <div className="bg-black/60 backdrop-blur-md rounded-lg p-3 border border-white/10">
          <div className="flex justify-between items-center mb-1">
            <div className="text-xs font-bold text-gray-300 uppercase flex items-center gap-1">
              <span>😮</span> 生长 (Mouth)
            </div>
            <span ref={growthTextRef} className="text-xs font-mono text-yellow-400">0%</span>
          </div>
          <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
            <div ref={growthBarRef} className="h-full bg-yellow-400 w-0 transition-all duration-75 ease-out shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>
          </div>
        </div>

        {/* Clear (Updated Icon and Text) */}
        <div ref={clearContainerRef} className="bg-black/60 backdrop-blur-md rounded-lg p-3 border border-white/10 transition-colors duration-300">
          <div className="flex justify-between items-center mb-1">
            <div className="text-xs font-bold text-gray-300 uppercase flex items-center gap-1">
              <span>🖐️</span> 清除 (Open Hand)
            </div>
            <span ref={clearTextRef} className="text-xs font-mono text-red-500">0.0s</span>
          </div>
          <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
            <div ref={clearBarRef} className="h-full bg-red-500 w-0 transition-all duration-75 linear shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
          </div>
        </div>

      </div>

      {showControls ? (
        <ControlPanel 
          config={config} 
          onConfigChange={handleConfigChange} 
          onClose={() => setShowControls(false)}
        />
      ) : (
        <button
          onClick={() => setShowControls(true)}
          className="absolute right-4 top-4 w-12 h-12 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white/80 hover:bg-white/10 hover:text-white hover:scale-110 transition-all duration-300 z-30 shadow-[0_0_15px_rgba(255,255,255,0.1)] group"
          title="显示设置 (按 'H' 切换)"
        >
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-90 transition-transform duration-500">
             <circle cx="12" cy="12" r="3"></circle>
             <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
           </svg>
        </button>
      )}
      
    </div>
  );
};

export default App;
