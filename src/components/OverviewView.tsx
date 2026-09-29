import React from 'react';
import { FarmTwin } from '../types/farm-twin';
import { Advisory } from '../types/advisory';
import { WeatherData, SatelliteData, SoilData } from '../types/external-data';
import { ProviderStatusCode } from '../types/database';
import { DataProvenance } from '../services/external-data-providers';
import { GeospatialFarmMap } from './GeospatialFarmMap';
import { CROP_PARAMETERS_REGISTRY, cropTwinSimulation } from '../adapters/crop-twin-simulation-service';
import { CropStage } from '../types/core';
import { RefreshCw, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface OverviewViewProps {
  farm?: FarmTwin;
  advisories: Advisory[];
  weather: WeatherData | null;
  satellite: SatelliteData | null;
  soil: SoilData | null;
  weatherStatus?: ProviderStatusCode;
  satelliteStatus?: ProviderStatusCode;
  soilStatus?: ProviderStatusCode;
  weatherProvenance?: DataProvenance;
  satelliteProvenance?: DataProvenance;
  soilProvenance?: DataProvenance;
  onNavigateTab: (tab: 'farms' | 'digital-twin' | 'simulation' | 'weather' | 'satellite' | 'advisories' | 'copilot') => void;
  onSelectFarmId: (farmId: string) => void;
  allFarms: FarmTwin[];
  onOpenAddFarm?: () => void;
  onRefreshWeather?: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  farm,
  advisories,
  weather,
  satellite,
  soil,
  weatherStatus,
  satelliteStatus,
  soilStatus,
  weatherProvenance,
  satelliteProvenance,
  soilProvenance,
  onNavigateTab,
  onSelectFarmId,
  allFarms,
  onOpenAddFarm,
  onRefreshWeather,
}) => {
  if (!farm) {
    return (
      <div className="border border-slate-800 bg-[#121820] p-12 text-center rounded-xs space-y-4 font-mono my-6">
        <div className="text-slate-500 text-xs uppercase tracking-wider">Field Registry · 0 Active Farms</div>
        <h2 className="text-2xl font-semibold text-white">No Registered Farm Twins</h2>
        <p className="text-slate-400 text-sm max-w-lg mx-auto font-sans leading-relaxed">
          Your account currently has no agricultural parcels registered. Create a farm parcel, configure your crop parameters, and initiate live digital twin telemetry anywhere in India.
        </p>
        <div className="pt-2">
          <button
            onClick={onOpenAddFarm || (() => onNavigateTab('farms'))}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer"
          >
            + Register Your First Farm
          </button>
        </div>
      </div>
    );
  }

  const { farmConfiguration, location, currentState } = farm;
  const cropParams = CROP_PARAMETERS_REGISTRY[farmConfiguration.cropType];

  // Advisories for this farm
  const farmAdvisories = advisories.filter(
    (a) => a.farmTwinId === farm.twinId || a.farmTwinId.includes(farm.twinId.split('-')[0])
  );
  const displayAdvisories = farmAdvisories;

  // Evaluate Digital Twin Pipeline against live inputs (Strict Requirement 9)
  const pipelineEval = cropTwinSimulation.evaluateDigitalTwinPipeline(farm, weather, satellite, soil);

  // Stage formatting
  const formattedStage = pipelineEval.phenologicalStage.stage
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const stress = pipelineEval.stressIndicators || currentState.stressIndicators;

  const getStressColor = (val: number) => {
    if (val >= 0.65) return 'text-rose-400 bg-rose-500';
    if (val >= 0.4) return 'text-amber-400 bg-amber-500';
    return 'text-emerald-400 bg-emerald-500';
  };

  // Phenological Stages sequence
  const stages: Array<{ id: CropStage; label: string; days: number }> = [
    { id: CropStage.GERMINATION, label: 'Germination', days: cropParams?.growthDuration[CropStage.GERMINATION] || 8 },
    { id: CropStage.VEGETATIVE, label: 'Vegetative', days: cropParams?.growthDuration[CropStage.VEGETATIVE] || 45 },
    { id: CropStage.FLOWERING, label: 'Flowering', days: cropParams?.growthDuration[CropStage.FLOWERING] || 35 },
    { id: CropStage.FRUITING, label: 'Fruiting', days: cropParams?.growthDuration[CropStage.FRUITING] || 30 },
    { id: CropStage.MATURITY, label: 'Maturity', days: cropParams?.growthDuration[CropStage.MATURITY] || 20 },
  ];

  let cumulative = 0;
  const stageRanges = stages.map((s) => {
    const start = cumulative;
    cumulative += s.days;
    return { ...s, start, end: cumulative };
  });

  const plantingDateStr = farmConfiguration.plantingDate
    ? new Date(farmConfiguration.plantingDate).toISOString().split('T')[0]
    : 'Not Recorded';

  return (
    <div className="space-y-6 text-slate-200">
      {/* 1. Farm Header & Primary Metadata */}
      <div className="border-b border-slate-800 pb-5 pt-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono mb-1">
            <span>TWIN ID: {farm.twinId}</span>
            <span aria-hidden="true">·</span>
            <span>PARCEL: {location.village || farm.twinId}</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-300">WGS-84 EPSG:4326</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
            {location.district} {farmConfiguration.cropType.toUpperCase()} FIELD
          </h1>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-300 mt-2 font-sans">
            <span className="font-semibold text-emerald-400 capitalize">
              {farmConfiguration.cropType} ({farmConfiguration.varietyName || 'Registered Variety'})
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{location.district}, {location.state}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{farmConfiguration.farmSize} Hectares</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="capitalize">{farmConfiguration.irrigationType} Irrigation</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="capitalize">{farmConfiguration.soilType.replace('_', ' ')} Soil</span>
          </div>
        </div>

        {/* Global Action Shortcut Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          {onRefreshWeather && (
            <button
              onClick={onRefreshWeather}
              className="px-3 py-1.5 bg-[#16212e] hover:bg-[#1f2d3d] border border-slate-700 text-xs font-mono text-slate-200 rounded-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Telemetry
            </button>
          )}
          <button
            onClick={() => onNavigateTab('copilot')}
            className="px-3 py-1.5 bg-emerald-700/90 hover:bg-emerald-600 border border-emerald-500/50 text-xs font-mono text-white rounded-xs transition-colors font-semibold cursor-pointer flex items-center gap-1.5"
          >
            <span>✦ Ask Copilot</span>
          </button>
          <button
            onClick={() => onNavigateTab('digital-twin')}
            className="px-3 py-1.5 bg-[#16212e] hover:bg-[#1f2d3d] border border-slate-700 text-xs font-mono text-slate-200 rounded-xs transition-colors cursor-pointer"
          >
            Digital Twin →
          </button>
          <button
            onClick={() => onNavigateTab('simulation')}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-mono text-white rounded-xs transition-colors font-semibold cursor-pointer"
          >
            Run Simulation
          </button>
        </div>
      </div>

      {/* 2. DATA FRESHNESS & PROVENANCE BAR (Strict Requirement 8) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
        {/* Weather Provenance */}
        <div className="p-3 bg-[#111923] border border-slate-800 rounded-xs space-y-1">
          <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase">
            <span>Weather Telemetry</span>
            <span className={`font-bold ${weatherStatus === 'LIVE' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {weatherStatus === 'LIVE' ? 'OBSERVED' : 'UNAVAILABLE'}
            </span>
          </div>
          <div className="font-bold text-white text-[11px]">Source: Open-Meteo WMO NWP</div>
          <div className="text-[10px] text-slate-400">
            {weather ? `Observed: ${weatherProvenance?.observed_at ? new Date(weatherProvenance.observed_at).toLocaleTimeString() : 'Live'}` : 'Weather unavailable'}
          </div>
        </div>

        {/* Satellite Provenance */}
        <div className="p-3 bg-[#111923] border border-slate-800 rounded-xs space-y-1">
          <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase">
            <span>Earth Observation</span>
            <span className={`font-bold ${satellite ? 'text-emerald-400' : 'text-rose-400'}`}>
              {satellite ? 'OBSERVED / DERIVED' : 'UNAVAILABLE'}
            </span>
          </div>
          <div className="font-bold text-white text-[11px]">Source: Copernicus Sentinel-2 L2A</div>
          <div className="text-[10px] text-slate-400">
            {satellite ? `Acquired: ${new Date(satellite.captureDate).toLocaleDateString()}` : 'No usable Sentinel-2 pass'}
          </div>
        </div>

        {/* Soil Provenance */}
        <div className="p-3 bg-[#111923] border border-slate-800 rounded-xs space-y-1">
          <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase">
            <span>Pedological Telemetry</span>
            <span className={`font-bold ${soil ? 'text-sky-400' : 'text-rose-400'}`}>
              {soil ? 'MODELED' : 'UNAVAILABLE'}
            </span>
          </div>
          <div className="font-bold text-white text-[11px]">Source: ISRIC SoilGrids 2.0 (250m)</div>
          <div className="text-[10px] text-slate-400">
            {soil ? 'Spatial/modelled soil information' : 'Soil data unavailable'}
          </div>
        </div>
      </div>

      {/* 3. Top Tier: GIS Geospatial Map + Phenology Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Map Component */}
        <div className="lg:col-span-7">
          <GeospatialFarmMap
            selectedFarm={farm}
            allFarms={allFarms}
            onSelectFarmId={onSelectFarmId}
            weather={weather}
            satellite={satellite}
          />
        </div>

        {/* Right Column (5 cols): Growth Phenology & Yield Prediction */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card A: Phenological Stage Progress Bar */}
          <div className="border border-slate-800 bg-[#121820] p-5 rounded-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs text-slate-500 font-mono uppercase tracking-wider block">
                  Current Physiological Stage
                </span>
                <span className="text-lg font-bold text-white tracking-tight">
                  {formattedStage}
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="text-xl font-bold text-emerald-400 tabular-nums">
                  {currentState.daysAfterPlanting}
                </span>
                <span className="text-xs text-slate-400 block -mt-1">Days After Planting (DAP)</span>
              </div>
            </div>

            {/* Linear Stage Pipeline Indicator */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>Vegetative Sequence</span>
                <span>Planting: {plantingDateStr}</span>
              </div>

              <div className="grid grid-cols-5 gap-1.5 h-2">
                {stageRanges.map((stg) => {
                  const isCompleted = currentState.daysAfterPlanting >= stg.end;
                  const isCurrent =
                    currentState.daysAfterPlanting >= stg.start &&
                    currentState.daysAfterPlanting < stg.end;

                  return (
                    <div
                      key={stg.id}
                      className={`h-full rounded-2xs transition-colors ${
                        isCompleted
                          ? 'bg-emerald-500'
                          : isCurrent
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-slate-800'
                      }`}
                      title={`${stg.label} (${stg.days} days)`}
                    />
                  );
                })}
              </div>

              <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                <span>Germination</span>
                <span>Flowering</span>
                <span>Harvest Ready</span>
              </div>
            </div>
          </div>

          {/* Card B: Scientific Yield Prediction (Strict Requirement 9: Labeled MODEL PREDICTION) */}
          <div className="border border-slate-800 bg-[#121820] p-5 rounded-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs text-slate-500 font-mono uppercase tracking-wider block">
                  Biological Yield Output
                </span>
                <span className="text-sm font-semibold text-white tracking-tight">
                  Harvest Yield Forecast
                </span>
              </div>
              <span className="px-2 py-0.5 bg-amber-950/80 border border-amber-500/50 text-amber-300 text-[10px] font-mono font-bold">
                MODEL PREDICTION
              </span>
            </div>

            {pipelineEval.yieldPrediction ? (
              <div className="space-y-3 font-mono">
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-bold text-white tabular-nums tracking-tight">
                    {pipelineEval.yieldPrediction.valueKgHa}
                  </span>
                  <span className="text-slate-400 text-xs font-sans">kg/hectare</span>
                  <span className="text-emerald-400 text-xs ml-auto">
                    (Optimal Potential: {cropParams?.yieldPotential.optimal || 2400} kg/ha)
                  </span>
                </div>

                <div className="text-[11px] text-slate-400">
                  Forecast Band: <strong className="text-slate-200">{pipelineEval.yieldPrediction.minKgHa}</strong> to{' '}
                  <strong className="text-slate-200">{pipelineEval.yieldPrediction.maxKgHa} kg/ha</strong> (Confidence: {Math.round(pipelineEval.yieldPrediction.confidence * 100)}%)
                </div>

                <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xs text-[10px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300">Biophysical Attenuation Factors:</div>
                  {pipelineEval.yieldPrediction.factors.length > 0 ? (
                    pipelineEval.yieldPrediction.factors.map((f, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{f.name}</span>
                        <span className={f.impactPercent < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                          {f.impactPercent > 0 ? `+${f.impactPercent}%` : `${f.impactPercent}%`}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div>Zero stress penalties applied under current telemetry.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-rose-950/20 border border-rose-800/40 rounded-xs space-y-2 font-mono text-xs">
                <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Yield prediction unavailable</span>
                </div>
                <div className="text-slate-300 text-[11px] font-sans">
                  Missing required inputs: <strong className="text-white">{pipelineEval.missingInputs.join(', ')}</strong>.
                </div>
                <div className="text-[10px] text-slate-500">
                  In accordance with zero-fake-data rules, no synthetic yield estimate is invented.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Stress Indicators Matrix */}
      <div className="border border-slate-800 bg-[#121820] p-5 rounded-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
            Biophysical Stress & Risk Scoring (0.00 – 1.00 Matrix)
          </h2>
          <span className="text-xs font-mono text-slate-400">
            Source: CropTwin Biophysical Model · WMO Gridded Telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          {/* Water Stress */}
          <div className="border border-slate-800/80 p-3 bg-slate-900/60 space-y-2">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Water Deficit Stress</span>
              <span className={`font-bold tabular-nums ${getStressColor(stress.waterStress).split(' ')[0]}`}>
                {(stress.waterStress * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 overflow-hidden">
              <div className={`h-full ${getStressColor(stress.waterStress).split(' ')[1]}`} style={{ width: `${Math.min(100, stress.waterStress * 100)}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 block">Root-zone tension relative to field capacity</span>
          </div>

          {/* Heat Stress */}
          <div className="border border-slate-800/80 p-3 bg-slate-900/60 space-y-2">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Thermal Heat Stress</span>
              <span className={`font-bold tabular-nums ${getStressColor(stress.heatStress).split(' ')[0]}`}>
                {(stress.heatStress * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 overflow-hidden">
              <div className={`h-full ${getStressColor(stress.heatStress).split(' ')[1]}`} style={{ width: `${Math.min(100, stress.heatStress * 100)}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 block">Ambient vs {cropParams?.optimalTemperatureMax || 32}°C threshold</span>
          </div>

          {/* Pest Risk */}
          <div className="border border-slate-800/80 p-3 bg-slate-900/60 space-y-2">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Pest Infiltration Risk</span>
              <span className={`font-bold tabular-nums ${getStressColor(stress.pestRisk).split(' ')[0]}`}>
                {(stress.pestRisk * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 overflow-hidden">
              <div className={`h-full ${getStressColor(stress.pestRisk).split(' ')[1]}`} style={{ width: `${Math.min(100, stress.pestRisk * 100)}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 block">RH & Temperature coincidence</span>
          </div>

          {/* Disease Risk */}
          <div className="border border-slate-800/80 p-3 bg-slate-900/60 space-y-2">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Pathogen Disease Risk</span>
              <span className={`font-bold tabular-nums ${getStressColor(stress.diseaseRisk).split(' ')[0]}`}>
                {(stress.diseaseRisk * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 overflow-hidden">
              <div className={`h-full ${getStressColor(stress.diseaseRisk).split(' ')[1]}`} style={{ width: `${Math.min(100, stress.diseaseRisk * 100)}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 block">Leaf wetness duration indicator</span>
          </div>
        </div>
      </div>

      {/* 5. Lower Workspaces: Environmental Telemetry Table + Active Advisories */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (7 cols): Recent Environmental Observations */}
        <div className="lg:col-span-7 border border-slate-800 bg-[#121820] p-5 rounded-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
              Meteorological Observations (Open-Meteo)
            </h2>
            <button
              onClick={() => onNavigateTab('weather')}
              className="text-xs text-slate-400 hover:text-emerald-400 transition-colors font-mono cursor-pointer"
            >
              Full Forecast →
            </button>
          </div>

          {weather && weather.forecast && weather.forecast.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 px-3 text-right">Max Temp</th>
                    <th className="py-2 px-3 text-right">Min Temp</th>
                    <th className="py-2 px-3 text-right">Precipitation</th>
                    <th className="py-2 pl-3 text-right">Wind</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {weather.forecast.slice(0, 5).map((f, i) => {
                    const dateStr = typeof f.date === 'string'
                      ? f.date
                      : (f.date instanceof Date ? f.date.toISOString().split('T')[0] : String(f.date));
                    const rainAmount = typeof f.precipitation === 'object' && f.precipitation !== null
                      ? (f.precipitation as any).amount
                      : Number(f.precipitation || 0);

                    return (
                      <tr key={dateStr || i} className="hover:bg-slate-800/30">
                        <td className="py-2 pr-3 font-semibold text-slate-200">{dateStr}</td>
                        <td className="py-2 px-3 text-right text-rose-300 tabular-nums">
                          {typeof f.temperature === 'object' ? f.temperature.max : f.temperature}°C
                        </td>
                        <td className="py-2 px-3 text-right text-sky-300 tabular-nums">
                          {typeof f.temperature === 'object' ? f.temperature.min : f.temperature}°C
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {rainAmount > 0 ? (
                            <span className="text-sky-400">{rainAmount} mm</span>
                          ) : (
                            <span className="text-slate-600">0.0 mm</span>
                          )}
                        </td>
                        <td className="py-2 pl-3 text-right text-slate-400 tabular-nums">
                          {f.windSpeed} km/h
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-xs font-mono text-slate-500 border border-slate-800/60 bg-slate-900/40">
              Weather telemetry currently unavailable. Click "Refresh Telemetry" to query Open-Meteo.
            </div>
          )}
        </div>

        {/* Right (5 cols): Active Advisories For This Farm */}
        <div className="lg:col-span-5 border border-slate-800 bg-[#121820] p-5 rounded-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
              Active Prescriptions ({displayAdvisories.length})
            </h2>
            <button
              onClick={() => onNavigateTab('advisories')}
              className="text-xs text-slate-400 hover:text-emerald-400 transition-colors font-mono cursor-pointer"
            >
              Advisory Desk →
            </button>
          </div>

          <div className="space-y-3 font-sans">
            {displayAdvisories.length > 0 ? (
              displayAdvisories.map((adv) => (
                <div
                  key={adv.advisoryId}
                  className="p-3 border border-slate-800 bg-slate-900/80 rounded-xs space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-white">{adv.title}</span>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 uppercase tracking-wider font-bold ${
                        adv.priority === 'high'
                          ? 'text-rose-400 border border-rose-500/40 bg-rose-950/30'
                          : 'text-amber-400 border border-amber-500/40 bg-amber-950/30'
                      }`}
                    >
                      {adv.priority}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">{adv.description}</p>
                  {adv.actionItems && adv.actionItems[0] && (
                    <div className="pt-2 border-t border-slate-800/80 text-[11px] text-emerald-400 font-mono">
                      Prescription: {adv.actionItems[0].action}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs font-mono text-slate-500 border border-slate-800/60 bg-slate-900/40">
                0 Active Advisories. Generate agronomic prescriptions from the Advisory Desk.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
