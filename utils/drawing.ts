
import { FlowerSpecies, Plant, Seed, Particle } from '../types';

export const drawSeed = (ctx: CanvasRenderingContext2D, seed: Seed) => {
  ctx.save();
  ctx.translate(seed.x, seed.y);
  
  // Glowing effect
  const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, 10);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.5, seed.color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
};

export const drawParticle = (ctx: CanvasRenderingContext2D, particle: Particle) => {
  ctx.save();
  ctx.globalAlpha = Math.max(0, particle.life);
  ctx.fillStyle = particle.color;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export const drawPlant = (ctx: CanvasRenderingContext2D, plant: Plant, globalHeightFactor: number) => {
  // Apply global height factor. 
  // effectiveProgress combines individual growth (mouth) and global setting (slider)
  const effectiveProgress = plant.growthProgress * globalHeightFactor;

  if (effectiveProgress < 0.01) return;

  const currentHeight = plant.maxHeight * effectiveProgress;
  const startX = plant.x;
  const startY = plant.y;
  const endY = startY - currentHeight;

  ctx.save();
  ctx.strokeStyle = '#4ade80'; // Green stem
  ctx.lineWidth = 4 * effectiveProgress;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw Stem (Procedural curve)
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  
  ctx.quadraticCurveTo(
    startX + (Math.sin(plant.seed) * 20), 
    startY - (currentHeight / 2), 
    startX + (Math.cos(plant.seed) * 10), 
    endY
  );
  ctx.stroke();

  // Draw Leaves
  if (effectiveProgress > 0.3) {
    const leafCount = 2;
    for (let i = 0; i < leafCount; i++) {
      const leafY = startY - (currentHeight * ((i + 1) / (leafCount + 1)));
      const side = i % 2 === 0 ? 1 : -1;
      const leafSize = 20 * effectiveProgress;
      
      ctx.beginPath();
      ctx.fillStyle = '#22c55e';
      ctx.ellipse(
        startX + (side * 5), 
        leafY, 
        leafSize, 
        leafSize / 3, 
        (side * Math.PI) / 4, 
        0, 
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  // Draw Flower
  if (effectiveProgress > 0.6) {
    const flowerScale = (effectiveProgress - 0.6) / 0.4; // 0 to 1 scaling
    const headX = startX + (Math.cos(plant.seed) * 10);
    const headY = endY;

    ctx.translate(headX, headY);
    ctx.scale(flowerScale, flowerScale);

    drawFlowerHead(ctx, plant.species, plant.color);
    
    ctx.restore();
  } else {
    ctx.restore();
  }
};

const drawFlowerHead = (ctx: CanvasRenderingContext2D, species: FlowerSpecies, color: string) => {
  switch (species) {
    case FlowerSpecies.Sunflower:
      // Petals
      ctx.fillStyle = '#f59e0b';
      for (let i = 0; i < 14; i++) {
        ctx.rotate((Math.PI * 2) / 14);
        ctx.beginPath();
        ctx.ellipse(0, 20, 6, 18, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Center
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#78350f'; // Brown
      ctx.fill();
      break;

    case FlowerSpecies.Tulip:
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-15, -20, -15, -40, 0, -50);
      ctx.bezierCurveTo(15, -40, 15, -20, 0, 0);
      ctx.fill();
      break;

    case FlowerSpecies.Rose:
      ctx.fillStyle = color;
      // Spiral body
      ctx.beginPath();
      for(let i=0; i<3; i++) {
          ctx.arc(Math.sin(i*2)*3, Math.cos(i*2)*3, 10 + i*4, 0, Math.PI*2);
      }
      ctx.fill();
      
      // Detail lines
      ctx.strokeStyle = adjustColorBrightness(color, -30);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI*2);
      ctx.stroke();
      break;
      
    case FlowerSpecies.Dandelion: // 蒲公英
      // Fluffy white head
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1;
      
      // Draw many fine lines from center
      for (let i = 0; i < 48; i++) {
        ctx.rotate((Math.PI * 2) / 48);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 24);
        ctx.stroke();
        
        // Little dots at the end
        ctx.beginPath();
        ctx.arc(0, 24, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
      }
      // Small center
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#d1d5db';
      ctx.fill();
      break;

    case FlowerSpecies.WildChrysanthemum: // 野菊
      // Small yellow petals, simpler than Sunflower, smaller center
      ctx.fillStyle = color === '#eab308' ? '#fde047' : color; // Use yellow if default theme, else theme
      const petals = 12;
      for (let i = 0; i < petals; i++) {
        ctx.rotate((Math.PI * 2) / petals);
        ctx.beginPath();
        ctx.ellipse(0, 12, 4, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Center
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#d97706'; // Darker center
      ctx.fill();
      break;
  }
};

// Simple utility to darken/lighten hex color
function adjustColorBrightness(hex: string, percent: number) {
    const num = parseInt(hex.replace('#', ''), 16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    G = (num >> 8 & 0x00FF) + amt,
    B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255)).toString(16).slice(1);
}
