import React, { useState, useEffect, useRef } from 'react';
import { FarmTwin } from '../types/farm-twin';
import { WeatherData, SatelliteData, SoilData } from '../types/external-data';
import { Advisory } from '../types/advisory';
import { Language } from '../types/core';
import { ProviderStatusCode } from '../types/database';
import { supabaseRepository } from '../services/supabase-repository';
import { Sparkles, Send, Bot, User, RefreshCw, Trash2, ShieldAlert, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';

interface GeminiCopilotViewProps {
  farm?: FarmTwin | null;
  weather: WeatherData | null;
  satellite: SatelliteData | null;
  soil: SoilData | null;
  advisories: Advisory[];
  weatherStatus?: ProviderStatusCode;
  satelliteStatus?: ProviderStatusCode;
  soilStatus?: ProviderStatusCode;
  onNavigateTab: (tab: 'overview' | 'simulation' | 'weather' | 'satellite' | 'advisories') => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export const GeminiCopilotView: React.FC<GeminiCopilotViewProps> = ({
  farm,
  weather,
  satellite,
  soil,
  advisories,
  weatherStatus,
  satelliteStatus,
  soilStatus,
  onNavigateTab,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(Language.ENGLISH);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [geminiConfigured, setGeminiConfigured] = useState<boolean>(true);
  const [diagnosticError, setDiagnosticError] = useState<string>('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Quick inquiry prompt chips grounded in actual farm context
  const quickPrompts = [
    { label: 'Why is my crop under stress?', query: 'Why is my crop currently under biophysical stress? Break down water vs thermal factors.' },
    { label: 'Explain condition simply', query: 'Explain my current crop condition simply, like a field guide.' },
    { label: 'What should I monitor?', query: 'What critical agronomic risk indicators should I monitor over the next 48 to 72 hours?' },
    { label: 'Why did yield prediction change?', query: 'Why did my yield prediction change and what are the main attenuation penalties?' },
    { label: 'What if rainfall drops 30%?', query: 'What happens if rainfall decreases by 30% over the next two weeks?' },
    { label: 'What if irrigation stops?', query: 'What happens to flowering biomass and yield if irrigation is stopped for 5 days?' },
    { label: 'Explain in Hindi', query: 'फसल की वर्तमान स्थिति और अगले 48 घंटों में जरूरी कृषि कार्य विस्तार से समझाएं।' },
  ];

  // Language options
  const languages: Array<{ code: Language; label: string }> = [
    { code: Language.ENGLISH, label: 'English' },
    { code: Language.HINDI, label: 'हिन्दी (Hindi)' },
    { code: Language.TELUGU, label: 'తెలుగు (Telugu)' },
    { code: Language.MARATHI, label: 'मराठी (Marathi)' },
    { code: Language.TAMIL, label: 'தமிழ் (Tamil)' },
    { code: Language.KANNADA, label: 'ಕನ್ನಡ (Kannada)' },
    { code: Language.PUNJABI, label: 'ਪੰਜਾਬੀ (Punjabi)' },
    { code: Language.BENGALI, label: 'বাংলা (Bengali)' },
    { code: Language.GUJARATI, label: 'ગુજરાતી (Gujarati)' },
    { code: Language.MALAYALAM, label: 'മലയാളം (Malayalam)' },
  ];

  // Check Gemini server configuration
  useEffect(() => {
    fetch('/api/gemini/status')
      .then((res) => res.json())
      .then((data) => {
        setGeminiConfigured(Boolean(data.configured));
        if (!data.configured) {
          setDiagnosticError(data.message || 'Gemini unavailable/not configured.');
        }
      })
      .catch(() => {
        setGeminiConfigured(false);
        setDiagnosticError('Failed to connect to Gemini backend proxy.');
      });
  }, []);

  // Load farm-specific conversation from Supabase memory
  useEffect(() => {
    if (!farm) {
      setMessages([]);
      return;
    }

    let isSubscribed = true;

    async function loadFarmConversation() {
      try {
        const conv = await supabaseRepository.getOrCreateConversation(farm!.twinId);
        if (!isSubscribed) return;
        setConversationId(conv.id);

        const loadedMessages = await supabaseRepository.getMessages(conv.id);
        if (!isSubscribed) return;

        if (loadedMessages && loadedMessages.length > 0) {
          setMessages(loadedMessages);
        } else {
          // Welcome message grounded in this farm's real context
          const welcome: ChatMessage = {
            id: `msg_welcome_${farm!.twinId}`,
            role: 'assistant',
            content: `**[AI EXPLANATION] Welcome to CropTwin Copilot.**
I have loaded real biophysical telemetry for **${farm!.location.district}, ${farm!.location.state}** (${farm!.farmConfiguration.cropType.toUpperCase()} · ${farm!.currentState.daysAfterPlanting} DAP).

- **Weather (Open-Meteo):** ${weather ? `${weather.current?.temperature}°C · ${weather.current?.humidity}% RH` : 'Weather unavailable'}
- **Earth Observation (Sentinel-2):** ${satellite ? `Scene ${satellite.sceneId?.substring(0, 24)}... (Cloud: ${satellite.cloudCover}%)` : 'No usable Sentinel-2 pass'}
- **Soil (ISRIC 250m):** ${soil ? `pH ${soil.soilProperties?.ph} · ${soil.soilProperties?.soilType}` : 'Soil data unavailable'}
- **CropTwin Model Result:** ${farm!.currentState?.predictedYield ? `${farm!.currentState.predictedYield} kg/ha (MODEL PREDICTION)` : 'Computing baseline'}

Ask any agronomic question or click a prompt chip below to begin.`,
            created_at: new Date().toISOString(),
          };
          setMessages([welcome]);
        }
      } catch (err) {
        console.warn('Error loading AI conversation for farm:', err);
      }
    }

    loadFarmConversation();

    return () => {
      isSubscribed = false;
    };
  }, [farm?.twinId]);

  // Scroll to bottom on message change
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || isLoading || !farm) return;

    setInputQuery('');
    setDiagnosticError('');

    // Append user message locally & to Supabase
    const userMsg: ChatMessage = {
      id: `msg_usr_${Date.now()}`,
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString(),
    };

    const updatedList = [...messages, userMsg];
    setMessages(updatedList);
    setIsLoading(true);

    if (conversationId) {
      await supabaseRepository.saveMessage({
        conversationId,
        role: 'user',
        content: textToSend,
      });
    }

    try {
      const res = await fetch('/api/gemini/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmTwin: farm,
          weather,
          satellite,
          soil,
          advisories,
          messages: updatedList,
          userQuery: textToSend,
          language: selectedLanguage,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gemini unavailable/not configured.');
      }

      const assistantMsg: ChatMessage = {
        id: `msg_ast_${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (conversationId) {
        await supabaseRepository.saveMessage({
          conversationId,
          role: 'assistant',
          content: data.reply,
          metadata: { modelUsed: data.modelUsed },
        });
      }
    } catch (err: any) {
      const errMsg = err.message || 'Gemini unavailable/not configured.';
      setDiagnosticError(errMsg);
      const failMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: `**[SYSTEM NOTICE] Gemini unavailable/not configured.**\n\n${errMsg}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, failMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!conversationId) return;
    await supabaseRepository.clearConversation(conversationId);
    setMessages([]);
  };

  if (!farm) {
    return (
      <div className="border border-slate-800 bg-[#121820] p-12 text-center rounded-xs space-y-4 font-mono">
        <div className="text-slate-500 text-xs uppercase tracking-wider">Agricultural Copilot</div>
        <h2 className="text-2xl font-semibold text-white">No Farm Selected</h2>
        <p className="text-slate-400 text-sm max-w-md mx-auto font-sans">
          Select or register an agricultural parcel to initiate an AI-assisted agronomy session grounded in real biophysical telemetry.
        </p>
        <button
          onClick={() => onNavigateTab('overview')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer"
        >
          Return to Overview
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-200">
      {/* 1. Header with Farm Context & Provenance Strip */}
      <div className="border-b border-slate-800 pb-5 pt-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono mb-1">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              GEMINI AGRICULTURAL COPILOT
            </span>
            <span aria-hidden="true">·</span>
            <span>GROUNDED IN REAL TELEMETRY</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
            Agronomy Intelligence · {farm.location.district} {farm.farmConfiguration.cropType.toUpperCase()}
          </h1>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-300 mt-2 font-mono">
            <span>Twin ID: {farm.twinId}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{farm.farmConfiguration.varietyName}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{farm.currentState.daysAfterPlanting} DAP</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-emerald-400 capitalize">{farm.currentState.cropStage}</span>
          </div>
        </div>

        {/* Language selector & conversation reset */}
        <div className="flex items-center space-x-2 shrink-0 font-mono text-xs">
          <div className="flex items-center space-x-1.5 bg-[#161f2a] border border-slate-700/80 px-2 py-1 rounded-xs">
            <span className="text-slate-500 text-[11px]">Language:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as Language)}
              className="bg-transparent text-slate-200 text-xs focus:outline-hidden cursor-pointer font-sans"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code} className="bg-[#121820]">
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleClearChat}
            title="Clear farm conversation"
            className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xs transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Provenance Grounding Bar (Zero Guesswork Transparency) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
        <div className="p-3 bg-[#111923] border border-slate-800 rounded-xs space-y-1">
          <div className="text-[10px] text-slate-500 uppercase flex justify-between">
            <span>Meteorology</span>
            <span className={weather ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
              {weather ? 'OBSERVED' : 'UNAVAILABLE'}
            </span>
          </div>
          <div className="font-bold text-white text-xs truncate">
            {weather ? `${weather.current?.temperature}°C · ${weather.current?.humidity}% RH` : 'Weather unavailable'}
          </div>
          <div className="text-[10px] text-slate-400 truncate">Source: Open-Meteo WMO NWP</div>
        </div>

        <div className="p-3 bg-[#111923] border border-slate-800 rounded-xs space-y-1">
          <div className="text-[10px] text-slate-500 uppercase flex justify-between">
            <span>Copernicus Earth Obs</span>
            <span className={satellite ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
              {satellite ? 'OBSERVED' : 'UNAVAILABLE'}
            </span>
          </div>
          <div className="font-bold text-white text-xs truncate">
            {satellite ? `Tile ${satellite.mgrsTile || 'S2'} (${satellite.cloudCover}% cloud)` : 'No usable scene'}
          </div>
          <div className="text-[10px] text-slate-400 truncate">Source: Sentinel-2 Level-2A</div>
        </div>

        <div className="p-3 bg-[#111923] border border-slate-800 rounded-xs space-y-1">
          <div className="text-[10px] text-slate-500 uppercase flex justify-between">
            <span>Soil Telemetry</span>
            <span className={soil ? 'text-sky-400 font-bold' : 'text-rose-400'}>
              {soil ? 'MODELED' : 'UNAVAILABLE'}
            </span>
          </div>
          <div className="font-bold text-white text-xs truncate">
            {soil ? `pH ${soil.soilProperties?.ph} · ${soil.soilProperties?.soilType}` : 'Soil data unavailable'}
          </div>
          <div className="text-[10px] text-slate-400 truncate">Source: ISRIC SoilGrids (0-5cm)</div>
        </div>

        <div className="p-3 bg-[#111923] border border-slate-800 rounded-xs space-y-1">
          <div className="text-[10px] text-slate-500 uppercase flex justify-between">
            <span>Model Prediction</span>
            <span className="text-amber-400 font-bold">MODEL RESULT</span>
          </div>
          <div className="font-bold text-white text-xs truncate">
            {farm.currentState?.predictedYield ? `${farm.currentState.predictedYield} kg/ha` : 'Calculating...'}
          </div>
          <div className="text-[10px] text-slate-400 truncate">CropTwin Biophysical Engine</div>
        </div>
      </div>

      {/* 3. Main Chat Stream & Input Area */}
      <div className="border border-slate-800 bg-[#121820] rounded-xs flex flex-col h-[580px]">
        {/* Chat message display area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-3 text-xs sm:text-sm ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-xs bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-xs p-3.5 space-y-2 leading-relaxed ${
                    isUser
                      ? 'bg-emerald-900/40 border border-emerald-500/30 text-emerald-100 font-sans'
                      : 'bg-[#16202c] border border-slate-800 text-slate-200 font-sans'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 border-b border-slate-700/40 pb-1 mb-1">
                    <span className="font-semibold text-slate-300">
                      {isUser ? 'Farmer Query' : 'CropTwin Agricultural Copilot'}
                    </span>
                    <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div className="whitespace-pre-wrap space-y-2">
                    {m.content.split('\n\n').map((para, idx) => {
                      if (para.includes('[MODEL RESULT]')) {
                        return (
                          <div key={idx} className="p-2.5 bg-amber-950/30 border border-amber-500/30 rounded-xs font-mono text-xs text-amber-200">
                            {para}
                          </div>
                        );
                      }
                      if (para.includes('[AI EXPLANATION]')) {
                        return (
                          <div key={idx} className="p-2.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xs text-xs text-emerald-200 font-sans">
                            {para}
                          </div>
                        );
                      }
                      return <p key={idx}>{para}</p>;
                    })}
                  </div>
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-xs bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 text-xs sm:text-sm justify-start">
              <div className="w-7 h-7 rounded-xs bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="bg-[#16202c] border border-slate-800 text-slate-400 rounded-xs p-3 font-mono text-xs flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Interpreting biophysical equations & real telemetry...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* 4. Grounded Prompt Suggestion Chips */}
        <div className="px-4 py-2 border-t border-slate-800/80 bg-[#0d141d] overflow-x-auto scrollbar-none flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-mono uppercase whitespace-nowrap">Suggested:</span>
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(p.query)}
              disabled={isLoading}
              className="px-2.5 py-1 text-xs whitespace-nowrap bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-emerald-300 rounded-xs transition-colors cursor-pointer shrink-0"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* 5. Input Field Bar */}
        <div className="p-3 border-t border-slate-800 bg-[#101722] flex items-center gap-2">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={`Ask Gemini about ${farm.location.district} ${farm.farmConfiguration.cropType}... (e.g., 'What is causing the moisture stress?')`}
            className="flex-1 bg-[#16202c] border border-slate-700/80 rounded-xs px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-sans"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputQuery.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      </div>
    </div>
  );
};
