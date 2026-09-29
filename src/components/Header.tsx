import React from 'react';
import { FarmTwin } from '../types/farm-twin';

export type NavTab = 
  | 'overview' 
  | 'farms' 
  | 'digital-twin'
  | 'simulation' 
  | 'weather' 
  | 'satellite' 
  | 'advisories' 
  | 'copilot'
  | 'config';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  farms: FarmTwin[];
  selectedFarmId: string;
  onSelectFarmId: (farmId: string) => void;
  alertCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  farms,
  selectedFarmId,
  onSelectFarmId,
  alertCount,
}) => {
  const navItems: Array<{ id: NavTab; label: string; count?: number; isAi?: boolean }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'farms', label: 'Farms', count: farms.length },
    { id: 'digital-twin', label: 'Digital Twin' },
    { id: 'simulation', label: 'Simulation' },
    { id: 'weather', label: 'Weather' },
    { id: 'satellite', label: 'Satellite' },
    { id: 'advisories', label: 'Advisories', count: alertCount > 0 ? alertCount : undefined },
    { id: 'copilot', label: 'Gemini Copilot', isAi: true },
  ];

  return (
    <header className="border-b border-slate-800 bg-[#0e141b] text-slate-100 select-none">
      {/* 3-Zone Top Bar Contract */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center space-x-3 shrink-0">
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('overview');
            }}
            className="flex items-baseline space-x-2 text-decoration-none"
          >
            <span className="text-base font-bold tracking-tight text-white font-mono uppercase">
              CropTwin
            </span>
            <span className="hidden lg:inline text-xs text-slate-400 font-sans">
              Geospatial Agronomy Intelligence
            </span>
          </a>
        </div>

        {/* Zone 2: Clean primary text navigation links */}
        <nav className="flex items-center space-x-1 sm:space-x-2 md:space-x-4 overflow-x-auto scrollbar-none py-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'text-emerald-400 font-semibold border-b-2 border-emerald-400 -mb-[1px]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-1">
                  {item.isAi && <span className="text-emerald-400">✦</span>}
                  <span>{item.label}</span>
                </span>
                {item.count !== undefined && (
                  <span
                    className={`ml-1.5 font-mono text-[10px] tabular-nums ${
                      isActive ? 'text-emerald-300' : 'text-slate-500'
                    }`}
                  >
                    ({item.count})
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Active Farm Selector & System Link */}
        <div className="flex items-center space-x-3 shrink-0">
          {/* Active Farm Switcher dropdown */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="hidden md:inline text-slate-500 text-[11px] uppercase tracking-wider font-mono">
              Farm:
            </span>
            <select
              value={selectedFarmId}
              onChange={(e) => onSelectFarmId(e.target.value)}
              className="bg-[#161f2a] border border-slate-700/80 rounded-xs text-xs text-slate-200 px-2 py-1 font-mono focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              {farms.length === 0 ? (
                <option value="">No Farms Registered</option>
              ) : (
                farms.map((f) => (
                  <option key={f.twinId} value={f.twinId}>
                    {f.location.district} · {f.farmConfiguration.cropType.toUpperCase()} ({f.farmConfiguration.varietyName})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Secondary Settings Action */}
          <button
            onClick={() => setActiveTab('config')}
            title="System & API Configuration"
            className={`px-2 py-1 text-xs border rounded-xs transition-colors cursor-pointer ${
              activeTab === 'config'
                ? 'border-slate-500 text-white bg-slate-800'
                : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            System
          </button>
        </div>
      </div>
    </header>
  );
};
