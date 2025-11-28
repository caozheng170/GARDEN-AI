
import React from 'react';
import { PlantConfig, FlowerSpecies, SpeciesSelection } from '../types';

interface ControlPanelProps {
  config: PlantConfig;
  onConfigChange: (newConfig: PlantConfig) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ config, onConfigChange }) => {
  
  const speciesOptions: { label: string; value: SpeciesSelection }[] = [
    { label: '随机 (Random)', value: 'Random' },
    { label: '玫瑰 (Rose)', value: FlowerSpecies.Rose },
    { label: '蒲公英 (Dandelion)', value: FlowerSpecies.Dandelion },
    { label: '野菊 (Daisy)', value: FlowerSpecies.WildChrysanthemum },
    { label: '郁金香 (Tulip)', value: FlowerSpecies.Tulip },
    { label: '向日葵 (Sunflower)', value: FlowerSpecies.Sunflower },
  ];

  return (
    <div className="absolute right-4 top-4 w-80 bg-black/60 backdrop-blur-md border border-white/20 rounded-xl p-6 text-white shadow-xl z-10 transition-all hover:bg-black/70">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span>🌿</span> 控制面板
      </h2>
      
      <div className="space-y-6">
        {/* Flower Species Buttons */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">花朵种类 (Species)</label>
          <div className="grid grid-cols-2 gap-2">
            {speciesOptions.map((option) => (
              <button
                key={option.label}
                onClick={() => onConfigChange({ ...config, selectedSpecies: option.value })}
                className={`px-2 py-2 text-xs rounded-lg border transition-all text-left truncate ${
                  config.selectedSpecies === option.value
                    ? 'bg-green-500/80 border-green-400 text-white shadow-lg'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Growth Height Slider */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300 flex justify-between">
            <span>生长高度 (Height)</span>
            <span className="text-green-400">{(config.growthHeightFactor * 100).toFixed(0)}%</span>
          </label>
          <input 
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={config.growthHeightFactor}
            onChange={(e) => onConfigChange({ ...config, growthHeightFactor: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-400"
          />
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>种子 (Seed)</span>
            <span>最高 (Max)</span>
          </div>
        </div>
      </div>
      
      <div className="mt-8 pt-4 border-t border-white/10 text-xs text-gray-400 space-y-2">
        <p>🖐️ <span className="text-white">捏合手指:</span> 播种</p>
        <p>😮 <span className="text-white">张开嘴巴:</span> 生长</p>
        <p>✊ <span className="text-white">握拳5秒:</span> 清除所有</p>
      </div>
    </div>
  );
};

export default ControlPanel;
