
export enum FlowerSpecies {
  Rose = '玫瑰',
  Dandelion = '蒲公英',
  WildChrysanthemum = '野菊',
  Tulip = '郁金香',
  Sunflower = '向日葵',
}

export type SpeciesSelection = FlowerSpecies | 'Random';

export interface PlantConfig {
  selectedSpecies: SpeciesSelection;
  growthHeightFactor: number; // 0.0 to 1.0
}

export interface Point {
  x: number;
  y: number;
}

export interface Seed {
  id: string;
  x: number;
  y: number;
  vy: number; // Vertical velocity
  species: FlowerSpecies;
  color: string;
  isLanded: boolean;
}

export interface Plant {
  id: string;
  x: number;
  y: number;
  height: number;
  maxHeight: number;
  growthProgress: number; // 0 to 1
  species: FlowerSpecies;
  color: string;
  seed: number; // Random seed for procedural variation
  stemControlPoints: Point[];
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number; // 1.0 to 0.0
  size: number;
}

export interface InteractionState {
  isPinching: boolean;
  pinchLocation: Point | null;
  pinchProximity: number; // 0 to 1
  mouthOpenness: number; // 0 to 1
  isPalmOpen: boolean; // Replaced isFistClenched
  clearTimer: number; // Replaced fistTimer, ms
}
