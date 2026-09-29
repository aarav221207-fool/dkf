import React, { useState } from 'react';
import { FarmTwin } from '../types/farm-twin';
import { IrrigationType, CropStage } from '../types/core';
import { cropTwinSimulation, CROP_PARAMETERS_REGISTRY } from '../adapters/crop-twin-simulation-service';
import { Sparkles, Bot, RefreshCw, ShieldAlert } from 'lucide-react';

interface SimulationLabProps {
  farms: FarmTwin[];
  selectedFarmId?: string;
  onSelectFarmId?: (id: string) => void;
  weather?: any;
  satellite?: any;
  soil?: any;
}

export const SimulationLab: React.FC<SimulationLabProps> = ({
  farms,
  selectedFarmId,
  onSelectFarmId,
}) => {
  const [activeFarmId, setActiveFarmId] = useState<string>(
    selectedFarmId || farms[0]?.twinId || ''
  );

  const baseFarm = farms.find((f) => f.twinId === activeFarmId) || farms[0];

  // Simulation controls state
  const [dap, setDap] = useState<number>(baseFarm?.currentState.daysAfterPlanting || 65);
  const [soilMoisture, setSoilMoisture] = useState<number>(baseFarm?.currentState.soilMoisture || 40);
  const [temperature, setTemperature] = useState<number>(
    baseFarm?.currentState.environmentalConditions.temperature.average || 32
  );
  const [rainfall7Days, setRainfall7Days] = useState<number>(
    baseFarm?.currentState.environmentalConditions.rainfall || 15
  );
  const [irrigationType, setIrrigationType] = useState<IrrigationType>(
    baseFarm?.farmConfiguration.irrigationType || IrrigationType.DRIP
  );

  // Gemini AI Scenario Explanation state
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState<boolean>(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const handleSelectFarm = (id: string) => {
    setActiveFarmId(id);
    if (onSelectFarmId) onSelectFarmId(id);
    const target = farms.find((f) => f.twinId === id);
    if (target) {
      setDap(target.currentState.daysAfterPlanting);
      setSoilMoisture(target.currentState.soilMoisture);
      setTemperature(target.currentState.environmentalConditions.temperature.average);
      setRainfall7Days(target.currentState.environmentalConditions.rainfall);
      setIrrigationType(target.farmConfiguration.irrigationType);
    }
  };

  const handleReset = () => {
    if (baseFarm) {
      setDap(baseFarm.currentState.daysAfterPlanting);
      setSoilMoisture(baseFarm.currentState.soilMoisture);
      setTemperature(baseFarm.currentState.environmentalConditions.temperature.average);
      setRainfall7Days(baseFarm.currentState.environmentalConditions.rainfall);
      setIrrigationType(baseFarm.farmConfiguration.irrigationType);
    }
  };

  const handleExplainScenario = async () => {
    if (!baseFarm) return;
    setIsExplaining(true);
    setExplainError(null);

    const baselineYield = baseFarm.currentState.predictedYield || 2100;
    const simYield = simulatedTwin.currentState.predictedYield;
    const yieldDelta = simYield - baselineYield;
    const yieldDeltaPercent = baselineYield > 0 ? ((yieldDelta / baselineYield) * 100).toFixed(1) : '0';

    try {
      const res = await fetch('/api/gemini/explain-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmTwin: baseFarm,
          baselineState: {
            yieldKgHa: baselineYield,
            waterStress: baseFarm.currentState.stressIndicators.waterStress,
            heatStress: baseFarm.currentState.stressIndicators.heatStress,
          },
          simulatedState: {
            yieldKgHa: simYield,
            waterStress: simulatedTwin.currentState.stressIndicators.waterStress,
            heatStress: simulatedTwin.currentState.stressIndicators.heatStress,
          },
          deltas: {
            yieldDeltaKgHa: yieldDelta,
            yieldDeltaPct: yieldDeltaPercent,
          },
          scenarioDescription: `DAP: ${dap} days, Root-zone Moisture: ${soilMoisture}%, Ambient Temp: ${temperature}°C, 7-Day Rainfall: ${rainfall7Days} mm, Irrigation Regime: ${irrigationType}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gemini unavailable/not configured.');
      }
      setAiExplanation(data.explanation);
    } catch (err: any) {
      setExplainError(err.message || 'Gemini unavailable/not configured.');
      setAiExplanation(null);
    } finally {
      setIsExplaining(false);
    }
  };

  if (!baseFarm) {
    return (
      <div className="border border-slate-800 bg-[#121820] p-12 text-center rounded-xs space-y-4 font-mono">
        <div className="text-slate-500 text-xs uppercase tracking-wider">Multi-Plot Simulation Workbench</div>
        <h2 className="text-2xl font-semibold text-white">No Registered Farms to Simulate</h2>
        <p className="text-slate-400 text-sm max-w-md mx-auto font-sans leading-relaxed">
          Create or select a farm parcel to execute biophysical what-if stress scenarios, GDD phenological stage shifts, and yield sensitivity tests.
        </p>
      </div>
    );
  }

  // Run the digital twin simulation engine
  const simulatedTwin = cropTwinSimulation.simulateTwinState(baseFarm, {
    daysAfterPlanting: dap,
    soilMoisture,
    ambientTemperature: temperature,
    rainfall7Days,
    irrigationType,
  });

  const baselineYield = baseFarm.currentState.predictedYield;
  const simYield = simulatedTwin.currentState.predictedYield;
  const yieldDelta = simYield - baselineYield;
  const yieldDeltaPercent = ((yieldDelta / baselineYield) * 100).toFixed(1);

  const stress = simulatedTwin.currentState.stressIndicators;
  const riskAlerts = cropTwinSimulation.assessFarmRisks(simulatedTwin);

  const formattedStage = simulatedTwin.currentState.cropStage
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const getStressColor = (val: number) => {
    if (val >= 0.6) return 'text-rose-400 bg-rose-500';
    if (val >= 0.35) return 'text-amber-400 bg-amber-500';
    return 'text-emerald-400 bg-emerald-500';
  };

  return (
    <div className="space-y-6 text-slate-200">
      {/* 1. Header */}
      <div className="border-b border-slate-800 pb-5 pt-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs text-slate-400 font-mono mb-1">
            AGRONOMIC SCENARIO ANALYSIS & STRESS RECALCULATION
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Twin Simulation Workbench
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 font-mono mt-1.5">
            <span>Dynamic GDD Shift</span>
            <span aria-hidden="true">·</span>
            <span>Moisture Deficit Modeling</span>
            <span aria-hidden="true">·</span>
            <span>Yield Impact Forecasting</span>
          </div>
        </div>

        {/* Farm Selector & Reset */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          <select
            value={activeFarmId}
            onChange={(e) => handleSelectFarm(e.target.value)}
            className="bg-[#161f2a] border border-slate-700 text-xs text-slate-200 px-3 py-1.5 rounded-xs focus:outline-hidden focus:border-emerald-500 cursor-pointer"
          >
            {farms.map((f) => (
              <option key={f.twinId} value={f.twinId}>
                {f.location.district} · {f.farmConfiguration.cropType.toUpperCase()} ({f.twinId})
              </option>
            ))}
          </select>

          <button
            onClick={handleReset}
            className="px-3 py-1.5 bg-[#16212e] hover:bg-[#1f2d3d] border border-slate-700 text-slate-300 rounded-xs transition-colors cursor-pointer"
          >
            Reset to Baseline
          </button>
        </div>
      </div>

      {/* 2. Main Simulation Workbench: 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Parameter Tuning Controls */}
        <div className="lg:col-span-5 border border-slate-800 bg-[#121820] p-5 rounded-xs space-y-5">
          <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
              Scenario Variables
            </h2>
            <span className="text-xs font-mono text-slate-400">
              Interactive Input
            </span>
          </div>

          {/* Days After Planting Slider */}
          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between items-center">
              <label className="text-slate-300 font-medium">Crop Age (DAP):</label>
              <span className="text-emerald-400 font-bold tabular-nums">{dap} Days</span>
            </div>
            <input
              type="range"
              min={1}
              max={150}
              value={dap}
              onChange={(e) => setDap(parseInt(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Planting (1d)</span>
              <span>Flowering (~65d)</span>
              <span>Harvest (150d)</span>
            </div>
          </div>

          {/* Soil Moisture Slider */}
          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between items-center">
              <label className="text-slate-300 font-medium">Volumetric Soil Moisture:</label>
              <span className="text-sky-400 font-bold tabular-nums">{soilMoisture}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={80}
              value={soilMoisture}
              onChange={(e) => setSoilMoisture(parseInt(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Drought (&lt;20%)</span>
              <span>Optimal (35-50%)</span>
              <span>Waterlogged (&gt;65%)</span>
            </div>
          </div>

          {/* Ambient Temperature Slider */}
          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between items-center">
              <label className="text-slate-300 font-medium">Ambient Temperature:</label>
              <span className="text-rose-400 font-bold tabular-nums">{temperature}°C</span>
            </div>
            <input
              type="range"
              min={10}
              max={50}
              value={temperature}
              onChange={(e) => setTemperature(parseInt(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Chilling (10°C)</span>
              <span>Optimal (28°C)</span>
              <span>Heatwave (48°C)</span>
            </div>
          </div>

          {/* 7-Day Rainfall */}
          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between items-center">
              <label className="text-slate-300 font-medium">7-Day Rainfall Accumulation:</label>
              <span className="text-sky-300 font-bold tabular-nums">{rainfall7Days} mm</span>
            </div>
            <input
              type="range"
              min={0}
              max={250}
              value={rainfall7Days}
              onChange={(e) => setRainfall7Days(parseInt(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Dry Spell (0 mm)</span>
              <span>Normal (30 mm)</span>
              <span>Torrential (200 mm)</span>
            </div>
          </div>

          {/* Irrigation System */}
          <div className="space-y-2 font-mono text-xs">
            <label className="text-slate-300 font-medium block">Irrigation Regime:</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: IrrigationType.DRIP, label: 'Drip Network' },
                { id: IrrigationType.SPRINKLER, label: 'Sprinkler' },
                { id: IrrigationType.FLOOD, label: 'Flood / Furrow' },
                { id: IrrigationType.RAINFED, label: 'Rainfed (Dryland)' },
              ].map((irr) => (
                <button
                  key={irr.id}
                  onClick={() => setIrrigationType(irr.id)}
                  className={`py-2 px-2.5 text-xs text-left border rounded-xs transition-colors cursor-pointer ${
                    irrigationType === irr.id
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200 font-semibold'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {irr.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Recalculated Twin Outputs */}
        <div className="lg:col-span-7 space-y-6">
          {/* Yield Delta & Phenological Outcome */}
          <div className="border border-slate-800 bg-[#121820] p-5 rounded-xs space-y-4">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                Simulation Response: Yield & Phenology
              </h2>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-amber-950/80 border border-amber-500/50 text-amber-300 text-[10px] font-mono font-bold">
                  MODEL PREDICTION
                </span>
                <span className="text-xs font-mono text-emerald-400 uppercase">
                  {formattedStage} Stage
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
              <div className="border border-slate-800/80 p-3 bg-slate-900/60">
                <span className="text-slate-500 block text-[11px]">Simulated Yield</span>
                <span className="text-2xl font-bold text-white tabular-nums">
                  {simYield.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 block">kg / ha</span>
              </div>

              <div className="border border-slate-800/80 p-3 bg-slate-900/60">
                <span className="text-slate-500 block text-[11px]">Yield Delta vs Baseline</span>
                <span
                  className={`text-2xl font-bold tabular-nums ${
                    yieldDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {yieldDelta >= 0 ? `+${yieldDelta}` : yieldDelta} kg/ha
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {yieldDelta >= 0 ? `+${yieldDeltaPercent}%` : `${yieldDeltaPercent}%`} shift
                </span>
              </div>

              <div className="border border-slate-800/80 p-3 bg-slate-900/60">
                <span className="text-slate-500 block text-[11px]">Phenological Stage</span>
                <span className="text-base font-bold text-emerald-300 capitalize">
                  {formattedStage}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {dap} Days After Planting
                </span>
              </div>
            </div>

            {/* Explain with Gemini AI button */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                Interpret biophysical yield attenuation factors with AI:
              </span>
              <button
                onClick={handleExplainScenario}
                disabled={isExplaining}
                className="px-3 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-mono font-semibold rounded-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isExplaining ? 'animate-spin' : ''}`} />
                <span>{isExplaining ? 'Interpreting...' : 'Explain Scenario with Gemini'}</span>
              </button>
            </div>

            {/* AI Explanation Result Box */}
            {aiExplanation && (
              <div className="p-4 bg-[#141d27] border border-emerald-500/40 rounded-xs space-y-2.5 text-xs font-sans">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold font-mono text-[11px]">
                    <Bot className="w-4 h-4" />
                    <span>AI EXPLANATION (Interpreting CropTwin Model Calculation)</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Source: Gemini 3.8 Flash</span>
                </div>
                <div className="text-slate-200 whitespace-pre-wrap leading-relaxed space-y-2">
                  {aiExplanation}
                </div>
              </div>
            )}

            {explainError && (
              <div className="p-3 bg-rose-950/20 border border-rose-800/50 rounded-xs text-xs font-mono text-rose-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{explainError}</span>
              </div>
            )}
          </div>

          {/* Dynamic 5-Factor Stress Matrix */}
          <div className="border border-slate-800 bg-[#121820] p-5 rounded-xs space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                Recalculated 5-Factor Stress Indices
              </h2>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-300">Water Deficit Stress:</span>
                  <span className={`font-semibold tabular-nums ${getStressColor(stress.waterStress).split(' ')[0]}`}>
                    {(stress.waterStress * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${getStressColor(stress.waterStress).split(' ')[1]}`}
                    style={{ width: `${Math.min(100, stress.waterStress * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-300">Heat / Thermal Stress:</span>
                  <span className={`font-semibold tabular-nums ${getStressColor(stress.heatStress).split(' ')[0]}`}>
                    {(stress.heatStress * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${getStressColor(stress.heatStress).split(' ')[1]}`}
                    style={{ width: `${Math.min(100, stress.heatStress * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-300">Pathogen / Disease Risk:</span>
                  <span className={`font-semibold tabular-nums ${getStressColor(stress.diseaseRisk).split(' ')[0]}`}>
                    {(stress.diseaseRisk * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${getStressColor(stress.diseaseRisk).split(' ')[1]}`}
                    style={{ width: `${Math.min(100, stress.diseaseRisk * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Triggered Risk Alerts */}
          <div className="border border-slate-800 bg-[#121820] p-5 rounded-xs space-y-4">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                Agronomic Risk Alerts ({riskAlerts.length})
              </h2>
            </div>

            {riskAlerts.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono">
                No acute stress thresholds violated under current scenario parameters.
              </p>
            ) : (
              <div className="space-y-3 font-mono text-xs">
                {riskAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className="p-3 border border-slate-800 bg-slate-900/80 rounded-xs space-y-1.5"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-rose-300 uppercase">
                        {alert.riskType.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 border border-rose-500/40 text-rose-400 bg-rose-950/30 uppercase font-bold">
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-slate-300 text-xs font-sans leading-relaxed">{alert.message}</p>
                    {alert.recommendations[0] && (
                      <div className="text-[11px] text-emerald-400 pt-1 border-t border-slate-800">
                        Action: {alert.recommendations[0]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
