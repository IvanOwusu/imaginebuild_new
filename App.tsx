import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  Box, Sparkles, ChevronRight, 
  Palette, Download, ArrowLeft, 
  Loader2, X, RefreshCw, MessageSquare, Send, 
  Sun, Moon, Pipette, Mic, Volume2, AudioLines,
  ArrowRight, AlertCircle, Wand2, Focus, FileDown,
  LayoutDashboard, Coins, Zap, Activity, Plus, CheckCircle2,
  Camera, SwitchCamera, Circle, ExternalLink, Info, Key, Upload, BrainCircuit, Globe,
  Layers, Move, Menu, FileCode, HelpCircle, BookOpen, Navigation, Link as LinkIcon,
  Mail, Phone, Linkedin, Twitter
} from 'lucide-react';
import DesignStepper from './components/DesignStepper';
import CostAnalysis from './components/CostAnalysis';
import { 
  ArchitecturalDesign, 
  DesignPreferences, 
  ProjectType, 
  ArchitecturalStyle 
} from './types';
import { 
  STYLE_PRESETS 
} from './constants';
import { 
  analyzeSite, 
  generateDesignConcept, 
  askArchitect,
  promptEditImage,
  generate3DModelFile,
  generateGLTFModelFile,
  getTutorialContent
} from './services/gemini';
import { GoogleGenAI, Modality, LiveServerMessage, Blob as GenAIBlob } from '@google/genai';

// --- Theme Helper ---
type AccentColor = 'emerald' | 'indigo' | 'amber' | 'rose';

const ACCENTS: Record<AccentColor, { primary: string; text: string; bg: string; border: string; glow: string; ring: string }> = {
  emerald: { primary: 'bg-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20', ring: 'ring-emerald-500/30' },
  indigo: { primary: 'bg-indigo-500', text: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', glow: 'shadow-indigo-500/20', ring: 'ring-indigo-500/30' },
  amber: { primary: 'bg-amber-500', text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', glow: 'shadow-amber-500/20', ring: 'ring-amber-500/30' },
  rose: { primary: 'bg-rose-500', text: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30', glow: 'shadow-rose-500/20', ring: 'ring-rose-500/30' },
};

// --- Pure PCM Encoding/Decoding ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): GenAIBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const steps = ['Site Discovery', 'Design Identity', 'Blueprint Synthesis'];

const TUTORIAL_TRACKS = [
  { key: 'Real-World Capture', description: 'Snap a site photo to start the process.', mode: 'landing' },
  { key: 'Contextual Discovery', description: 'Wait while we find real-world terrain logic.', mode: 'wizard' },
  { key: 'Simulation Forge', description: 'Review the design or consult the lead architect.', mode: 'detail' }
];

const FAQS = [
  "How does this app work?",
  "Who is the developer?",
  "Can I export 3D models?",
  "How do I contact Ivan?",
  "What styles are supported?"
];

const CameraCapture: React.FC<{ 
  onCapture: (base64: string) => void; 
  onClose: () => void;
  onUpload: () => void;
  accent: AccentColor;
}> = ({ onCapture, onClose, onUpload, accent }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'aligning' | 'ready'>('aligning');
  const [syncProgress, setSyncProgress] = useState(0);
  const currentTheme = ACCENTS[accent];

  useEffect(() => {
    let mounted = true;
    let currentStream: MediaStream | null = null;
    const startCamera = async () => {
      setError(null);
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (mounted) setError("Camera API not supported.");
        return;
      }
      try {
        if (stream) stream.getTracks().forEach(track => track.stop());
        let newStream: MediaStream;
        newStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } } 
        }).catch(() => navigator.mediaDevices.getUserMedia({ video: true }));

        if (mounted) {
          currentStream = newStream;
          setStream(newStream);
          if (videoRef.current) videoRef.current.srcObject = newStream;
        } else {
            newStream.getTracks().forEach(track => track.stop());
        }
      } catch (err: any) {
        if (mounted) setError("Camera unavailable. Check permissions.");
      }
    };
    startCamera();
    return () => {
      mounted = false;
      if (currentStream) currentStream.getTracks().forEach(track => track.stop());
    };
  }, [facingMode]);

  useEffect(() => {
    if (phase === 'aligning' && !error) {
      const interval = setInterval(() => {
        setSyncProgress(prev => {
          if (prev >= 100) return 100;
          return prev + Math.floor(Math.random() * 15);
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [phase, error]);

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      onCapture(canvas.toDataURL('image/jpeg', 0.85));
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center">
      <div className="absolute top-4 sm:top-8 left-4 sm:left-8 z-10 flex items-center gap-3 sm:gap-4">
        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-3 sm:p-4 rounded-full backdrop-blur-md text-white active:scale-95 transition-all"><X className="w-5 h-5 sm:w-6 sm:h-6" /></button>
        <div className="flex flex-col">
          <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">Capture Mode</span>
          <span className={`${currentTheme.text} text-[8px] font-black uppercase tracking-widest`}>{phase === 'aligning' ? 'Syncing...' : 'Ready'}</span>
        </div>
      </div>

      <div className="relative w-full h-full flex items-center justify-center bg-zinc-900 overflow-hidden">
        {!error ? (
            <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-all duration-1000 ${phase === 'aligning' ? 'grayscale brightness-50' : 'grayscale-0'}`} />
        ) : (
            <div className="text-center p-8 max-w-md">
                <h3 className="text-white text-xl font-bold mb-8">{error}</h3>
                <div className="flex flex-col gap-3">
                  <button onClick={() => { onClose(); onUpload(); }} className="bg-white text-black px-6 py-4 rounded-2xl font-black flex items-center justify-center gap-2">Upload File</button>
                  <button onClick={onClose} className="bg-white/10 px-6 py-4 rounded-2xl text-white font-bold">Cancel</button>
                </div>
            </div>
        )}

        {!error && phase === 'aligning' && (
          <div className="absolute inset-0 perspective-view flex flex-col items-center justify-center pointer-events-none">
            <div className={`w-[200vw] h-[200vw] ar-grid-overlay animate-grid-float transition-opacity duration-1000 ${syncProgress > 30 ? 'opacity-30' : 'opacity-0'}`} />
            <div className="absolute top-1/2 left-1/2 w-48 h-48 animate-reticle opacity-50">
               <svg viewBox="0 0 100 100" className={`w-full h-full ${currentTheme.text} fill-none stroke-current stroke-1`}><circle cx="50" cy="50" r="45" className="reticle-dash" /></svg>
            </div>
            <span className="text-white text-[10px] font-black uppercase tracking-[0.4em] bg-black/40 backdrop-blur-md px-4 py-2 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-24">{syncProgress}%</span>
          </div>
        )}
      </div>

      {!error && (
        <div className="absolute bottom-8 sm:bottom-12 w-full px-6 flex flex-col items-center gap-6">
            {phase === 'aligning' ? (
              <button 
                onClick={() => setPhase('ready')}
                disabled={syncProgress < 100}
                className={`w-full sm:w-auto px-10 py-5 rounded-3xl font-black text-white uppercase tracking-widest transition-all ${syncProgress < 100 ? 'bg-white/10 opacity-50' : `${currentTheme.primary} shadow-2xl active:scale-95`}`}
              >Set Point</button>
            ) : (
              <div className="flex items-center gap-8 sm:gap-12">
                <button onClick={() => setFacingMode(p => p === 'user' ? 'environment' : 'user')} className="bg-white/10 p-4 sm:p-5 rounded-full text-white backdrop-blur-md active:scale-90"><SwitchCamera className="w-6 h-6 sm:w-7 sm:h-7" /></button>
                <button onClick={captureFrame} className="bg-white p-1 rounded-full border-4 border-white/20 active:scale-90 transition-transform">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center"><div className={`w-12 h-12 sm:w-14 h-14 rounded-full ${currentTheme.primary}`} /></div>
                </button>
                <button onClick={() => setPhase('aligning')} className="bg-white/10 p-4 sm:p-5 rounded-full text-white backdrop-blur-md active:scale-90"><RefreshCw className="w-6 h-6 sm:w-7 sm:h-7" /></button>
              </div>
            )}
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

interface Message {
  role: string;
  content: string;
  sources?: string[];
}

const App: React.FC = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : true;
    }
    return true;
  });
  const [accent, setAccent] = useState<AccentColor>((localStorage.getItem('accent') as AccentColor) || 'emerald');
  const [showAccentPicker, setShowAccentPicker] = useState(false);
  const [viewMode, setViewMode] = useState<'landing' | 'dashboard' | 'wizard' | 'detail' | 'inspiration'>('landing');
  const [step, setStep] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [siteDiscovery, setSiteDiscovery] = useState<{ analysis: string, references: any[] } | null>(null);
  
  const [preferences, setPreferences] = useState<DesignPreferences>({
    type: ProjectType.RESIDENTIAL,
    style: ArchitecturalStyle.MODERN,
    floors: 2,
    budgetRange: 'Medium',
    materials: ['Glass', 'Concrete', 'Timber']
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [generatedDesign, setGeneratedDesign] = useState<ArchitecturalDesign | null>(null);
  const [projects, setProjects] = useState<ArchitecturalDesign[]>([]);
  const [currentCostData, setCurrentCostData] = useState<ArchitecturalDesign['costs'] | null>(null);
  
  // Minimalist Tutorial State
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeTutorialStep, setActiveTutorialStep] = useState(0);
  const [tutorialContent, setTutorialContent] = useState<string | null>(null);
  const [isTutorialLoading, setIsTutorialLoading] = useState(false);

  const [isVoiceConsultOpen, setIsVoiceConsultOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const liveSessionRef = useRef<any>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micStreamRef = useRef<MediaStream | null>(null);
  
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    localStorage.setItem('accent', accent);
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark, accent]);

  // Sync tutorial step with view mode
  useEffect(() => {
    if (viewMode === 'landing') setActiveTutorialStep(0);
    else if (viewMode === 'wizard') setActiveTutorialStep(1);
    else if (viewMode === 'detail') setActiveTutorialStep(2);
  }, [viewMode]);

  // Load tutorial sentence
  useEffect(() => {
    if (showTutorial) {
      const loadStepContent = async () => {
        setIsTutorialLoading(true);
        try {
          const content = await getTutorialContent(TUTORIAL_TRACKS[activeTutorialStep].key);
          setTutorialContent(content);
        } catch (e) {
          setTutorialContent(TUTORIAL_TRACKS[activeTutorialStep].description);
        } finally {
          setIsTutorialLoading(false);
        }
      };
      loadStepContent();
    }
  }, [showTutorial, activeTutorialStep]);

  const stopVoiceSession = useCallback(() => {
    if (liveSessionRef.current) try { liveSessionRef.current.close(); } catch(e) {}
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    if (inputAudioCtxRef.current) inputAudioCtxRef.current.close().catch(() => {});
    if (outputAudioCtxRef.current) outputAudioCtxRef.current.close().catch(() => {});
    audioSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    audioSourcesRef.current.clear();
    setIsVoiceConsultOpen(false);
    setIsConnecting(false);
  }, []);

  const handleVoiceConsult = async () => {
    if (isVoiceConsultOpen || isConnecting) { stopVoiceSession(); return; }
    setIsConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsVoiceConsultOpen(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const pcmBlob = createBlob(e.inputBuffer.getChannelData(0));
              sessionPromise.then(session => { try { session.sendRealtimeInput({ media: pcmBlob }); } catch(err) {} });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioCtxRef.current) {
              const ctx = outputAudioCtxRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              audioSourcesRef.current.add(source);
            }
          },
          onerror: () => { stopVoiceSession(); },
          onclose: () => stopVoiceSession(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: 'You are an expert Architect node. Help the user design spaces clearly.',
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (e: any) {
      setIsConnecting(false);
      stopVoiceSession();
    }
  };

  const startDiscovery = async (img: string) => {
    setUploadedImage(img);
    setViewMode('wizard');
    setStep(0);
    setIsGenerating(true);
    try {
      const discovery = await analyzeSite(img);
      setSiteDiscovery(discovery);
      setStep(1);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const startSynthesis = async () => {
    if (!uploadedImage || !siteDiscovery) return;
    setIsGenerating(true);
    setStep(2);
    try {
      const design = await generateDesignConcept(uploadedImage, preferences, siteDiscovery);
      setGeneratedDesign(design);
      setProjects(prev => [design, ...prev]);
      setCurrentCostData(design.costs);
      setViewMode('detail');
    } catch (error: any) {
      console.error(error);
    } finally { setIsGenerating(false); }
  };

  const handleRefineRealism = async () => {
    if (!generatedDesign || isGenerating) return;
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const matStr = generatedDesign.preferences.materials.join(", ");
      const refined = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `Hyper-realistic architectural visual of ${generatedDesign.name}. Style: ${generatedDesign.preferences.style}. Materials: ${matStr}.` }] }
      });
      const part = refined.candidates[0].content.parts.find((p: any) => p.inlineData);
      if (part?.inlineData) {
        setGeneratedDesign({...generatedDesign, visualizations: {...generatedDesign.visualizations, exterior: `data:image/png;base64,${part.inlineData.data}`}});
      }
    } finally { setIsGenerating(false); }
  };

  const handleExportOBJ = useCallback(async () => {
    if (!generatedDesign || isExporting) return;
    setIsExporting(true);
    try {
      const objContent = await generate3DModelFile(generatedDesign);
      const blob = new Blob([objContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${generatedDesign.name.replace(/\s+/g, '_')}_model.obj`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed", error);
    } finally { setIsExporting(false); }
  }, [generatedDesign, isExporting]);

  const handleExportGLTF = useCallback(async () => {
    if (!generatedDesign || isExporting) return;
    setIsExporting(true);
    try {
      const gltfContent = await generateGLTFModelFile(generatedDesign);
      const blob = new Blob([gltfContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${generatedDesign.name.replace(/\s+/g, '_')}_model.gltf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed", error);
    } finally { setIsExporting(false); }
  }, [generatedDesign, isExporting]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    const msg = text;
    setChatMessage("");
    setChatHistory(prev => [...prev, {role: 'user', content: msg}]);
    try { 
      const res = await askArchitect(msg, chatHistory); 
      setChatHistory(prev => [...prev, {role: 'model', content: res.text, sources: res.sources}]); 
    } catch(e) {}
  };

  const currentTheme = ACCENTS[accent];
  const Logo = () => (
    <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group" onClick={() => setViewMode('landing')}>
      <div className={`${currentTheme.primary} p-1 sm:p-1.5 rounded-lg shadow-lg ${currentTheme.glow}`}><Box className="text-white w-5 h-5 sm:w-6 sm:h-6" /></div>
      <div className="flex flex-col">
        <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-none tracking-tighter">Imaginebuild</span>
        <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] mt-0.5 ${currentTheme.text}`}>Architectural OS</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-indigo-500/20 relative">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-[0.03] dark:opacity-[0.05] blur-[120px] ${currentTheme.primary}`} />
      </div>

      {showCamera && (
        <CameraCapture 
          onCapture={startDiscovery} 
          onClose={() => setShowCamera(false)} 
          onUpload={() => { setShowCamera(false); fileInputRef.current?.click(); }}
          accent={accent} 
        />
      )}
      
      <nav className="border-b border-black/5 dark:border-white/5 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-[100] backdrop-blur-xl bg-white/70 dark:bg-navy-950/70">
        <Logo />
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => setShowTutorial(!showTutorial)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showTutorial ? `${currentTheme.primary} text-white` : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}
          >
            <Sparkles className="w-4 h-4" /> <span className="hidden sm:inline">AI Guide</span>
          </button>
          
          <button onClick={handleVoiceConsult} disabled={isConnecting} className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-sm font-bold border-2 transition-all ${isVoiceConsultOpen ? `${currentTheme.primary} text-white` : 'border-black/5 dark:border-white/10 active:bg-slate-50'}`}>
            {isConnecting ? <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" /> : (isVoiceConsultOpen ? <AudioLines className="w-3 h-3 sm:w-4 sm:h-4 animate-pulse" /> : <Volume2 className="w-3 h-3 sm:w-4 sm:h-4" />)}
            <span className="hidden sm:inline">{isConnecting ? 'Linking' : isVoiceConsultOpen ? 'Active Link' : 'Voice Link'}</span>
          </button>
          
          <button onClick={() => setShowAccentPicker(!showAccentPicker)} className={`p-2 rounded-xl transition-all ${showAccentPicker ? currentTheme.bg : 'hover:bg-slate-100 dark:hover:bg-white/5 active:scale-95'}`}><Pipette className="w-5 h-5" /></button>
          {showAccentPicker && (
            <div className="absolute top-full mt-3 right-0 bg-white dark:bg-navy-900 border border-black/10 dark:border-white/10 rounded-2xl p-3 shadow-2xl flex gap-3 animate-in fade-in slide-in-from-top-2">
              {(Object.keys(ACCENTS) as AccentColor[]).map(a => (
                <button key={a} onClick={() => { setAccent(a); setShowAccentPicker(false); }} className={`w-8 h-8 rounded-full ${ACCENTS[a].primary} ring-2 ring-offset-2 ${accent === a ? 'ring-slate-400' : 'ring-transparent'} active:scale-125 transition-transform`} />
              ))}
            </div>
          )}
          
          <button onClick={() => setIsDark(!isDark)} className="p-2 sm:p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 active:scale-95 transition-all">
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-400" />}
          </button>
        </div>
      </nav>

      {/* Simplified One-Sentence AI Guide HUD */}
      <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[400] w-[90%] max-w-2xl transition-all duration-500 transform ${showTutorial ? 'translate-y-0 opacity-100' : '-translate-y-12 opacity-0 pointer-events-none'}`}>
        <div className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-[2rem] p-4 sm:p-6 shadow-2xl flex items-center justify-between gap-4 overflow-hidden">
          <div className="flex items-center gap-4 flex-1">
            <div className={`${currentTheme.primary} p-2 rounded-xl text-white flex-shrink-0 animate-pulse`}>
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Guide</span>
              <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 truncate italic">
                {isTutorialLoading ? "Consulting..." : (tutorialContent || TUTORIAL_TRACKS[activeTutorialStep].description)}
              </p>
            </div>
          </div>
          <button onClick={() => setShowTutorial(false)} className="hover:bg-slate-100 dark:hover:bg-white/10 p-2 rounded-full transition-colors"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
      </div>

      <main className="flex-1 relative z-10 flex flex-col">
        {viewMode === 'landing' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6 py-12 md:py-24 max-w-7xl mx-auto w-full">
            <div className="mb-6 sm:mb-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 relative">
              <div className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full border ${currentTheme.border} ${currentTheme.bg} ${currentTheme.text} text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em]`}>
                <Sparkles className="w-3 h-3" /> Real-World Context Discovery
              </div>
            </div>
            
            <h1 className="text-5xl sm:text-7xl md:text-9xl lg:text-[140px] font-black text-slate-900 dark:text-white tracking-tighter leading-[0.9] mb-8 sm:mb-10 max-w-6xl">
              Imagine. Build. <br />
              <span className={`${currentTheme.text} italic text-glow`}>Instantly.</span>
            </h1>
            
            <p className="text-slate-500 dark:text-slate-400 text-base sm:text-lg md:text-xl max-w-2xl mb-12 sm:mb-16 font-medium">Capture real buildings or land. Generate simulations using internet-grounded architectural logic.</p>
            
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center justify-center w-full max-w-md sm:max-w-none">
              <button onClick={() => setShowCamera(true)} className={`${currentTheme.primary} w-full sm:w-auto text-white px-8 sm:px-12 py-5 sm:py-6 rounded-3xl font-black text-lg sm:text-xl flex items-center justify-center gap-4 hover:scale-105 active:scale-95 transition-all shadow-2xl ${currentTheme.glow}`}>
                <Camera className="w-6 h-6" /> Capture Site
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white px-8 sm:px-10 py-5 sm:py-6 rounded-3xl font-black text-lg flex items-center justify-center gap-3 active:bg-slate-200 dark:active:bg-white/10 transition-colors">
                Upload Photo <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            
            <input type="file" ref={fileInputRef} onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const r = new FileReader();
                r.onload = () => startDiscovery(r.result as string);
                r.readAsDataURL(file);
              }
            }} className="hidden" accept="image/*" />
          </div>
        )}

        {viewMode === 'wizard' && (
          <div className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-8 md:p-12 animate-in fade-in">
            <DesignStepper currentStep={step} steps={steps} />
            
            {isGenerating && step === 0 && (
              <div className="mt-20 text-center space-y-8">
                <div className="relative inline-block">
                  <Globe className={`w-16 h-16 ${currentTheme.text} animate-spin-slow`} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                </div>
                <h3 className="text-2xl font-black italic">Context Discovery...</h3>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Searching for real-world architectural references for your site.</p>
              </div>
            )}

            {step === 1 && siteDiscovery && (
              <div className="mt-12 sm:mt-20 space-y-12 sm:space-y-16">
                 <section className="bg-slate-50 dark:bg-white/5 p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5">
                   <h3 className="text-xl font-black mb-6 flex items-center gap-3 italic"><Navigation className={currentTheme.text} /> Discovery Logic</h3>
                   <p className="text-slate-600 dark:text-slate-400 font-bold leading-relaxed mb-8">{siteDiscovery.analysis}</p>
                   
                   {siteDiscovery.references.length > 0 && (
                     <div className="space-y-4">
                       <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Grounded Sources Found:</span>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         {siteDiscovery.references.map((ref, i) => (
                           <a key={i} href={ref.uri} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 bg-white dark:bg-white/5 rounded-2xl border border-black/5 hover:border-indigo-500/50 transition-all group">
                             <LinkIcon className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                             <span className="text-xs font-bold truncate">{ref.title}</span>
                             <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100" />
                           </a>
                         ))}
                       </div>
                     </div>
                   )}
                 </section>

                 <section>
                   <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-6 sm:mb-10 flex items-center gap-4"><Palette className={currentTheme.text} /> Design Identity</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {STYLE_PRESETS.map(s => (
                        <button key={s.id} onClick={() => setPreferences({...preferences, style: s.id as ArchitecturalStyle})} className={`p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border-2 text-left transition-all ${preferences.style === s.id ? `${currentTheme.border} ${currentTheme.bg} ring-2 ${currentTheme.ring}` : 'bg-white/50 dark:bg-white/5 border-black/5 dark:border-white/10 active:bg-slate-50'}`}>
                          <div className="flex items-center gap-4 mb-3 sm:mb-4">
                            <div className={`p-2 sm:p-3 rounded-xl ${preferences.style === s.id ? `${currentTheme.primary} text-white` : 'bg-slate-100 dark:bg-white/5'}`}>{s.icon}</div>
                            <span className="font-bold text-lg sm:text-xl text-slate-900 dark:text-white">{s.name}</span>
                          </div>
                          <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">{s.description}</p>
                        </button>
                      ))}
                   </div>
                 </section>
                 
                 <button disabled={isGenerating} onClick={startSynthesis} className={`${currentTheme.primary} w-full py-6 sm:py-8 rounded-3xl text-xl sm:text-2xl font-black text-white shadow-2xl active:scale-[0.98] transition-all disabled:opacity-50`}>
                    {isGenerating ? <Loader2 className="animate-spin mx-auto w-6 h-6 sm:w-8 sm:h-8" /> : 'Start Simulation'}
                 </button>
              </div>
            )}
          </div>
        )}

        {viewMode === 'detail' && generatedDesign && (
          <div className="flex-1 px-4 sm:px-6 md:px-12 py-8 sm:py-12 animate-in fade-in slide-in-from-bottom-8 pb-40">
            <div className="max-w-[1600px] mx-auto space-y-8 sm:space-y-12">
               <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                  <button onClick={() => setViewMode('dashboard')} className="flex items-center gap-3 text-slate-500 font-black uppercase tracking-widest text-[10px] active:scale-95"><ArrowLeft className="w-4 h-4" /> Studio</button>
                  <div className="flex flex-wrap gap-2 sm:gap-3 w-full lg:w-auto">
                     <button onClick={handleRefineRealism} disabled={isGenerating} className="flex-1 lg:flex-none bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 px-4 sm:px-6 py-3 rounded-xl font-black text-[10px] sm:text-xs flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 active:bg-indigo-100 transition-colors">
                        {isGenerating ? <Loader2 className="animate-spin w-4 h-4" /> : <Layers className="w-4 h-4" />} Refine Simulation
                     </button>
                     <button onClick={handleExportOBJ} disabled={isExporting} className="flex-1 lg:flex-none bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 px-4 sm:px-6 py-3 rounded-xl font-black text-[10px] sm:text-xs flex items-center justify-center gap-2 active:bg-slate-50">
                        {isExporting ? <Loader2 className="animate-spin w-4 h-4" /> : <FileDown className="w-4 h-4" />} OBJ
                     </button>
                     <button onClick={() => setIsEditing(!isEditing)} className={`flex-1 lg:flex-none px-4 sm:px-6 py-3 rounded-xl font-black text-[10px] sm:text-xs flex items-center justify-center gap-2 transition-all ${isEditing ? `${currentTheme.primary} text-white` : 'bg-white dark:bg-white/5 border border-black/5 active:bg-slate-50'}`}>
                        <RefreshCw className="w-4 h-4" /> Modulo
                     </button>
                  </div>
               </div>
               
               <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
                  <div className="lg:col-span-3 space-y-6 sm:space-y-12">
                     <div className="aspect-video bg-black rounded-[2rem] sm:rounded-[3.5rem] overflow-hidden shadow-2xl relative group border border-black/5 dark:border-white/5">
                        <img src={generatedDesign.visualizations?.exterior} className="w-full h-full object-cover" alt="Simulation" />
                        <div className="absolute top-8 left-8 bg-black/60 backdrop-blur-md text-white p-4 rounded-2xl border border-white/10">
                           <span className="block text-[8px] font-black uppercase tracking-widest text-indigo-400 mb-1">Status</span>
                           <span className="text-sm font-black italic">Simulation Grounded</span>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-black/5 shadow-xl">
                           <h3 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3 mb-6">
                              <BrainCircuit className={currentTheme.text} /> Real-World Synthesis
                           </h3>
                           <p className="text-slate-600 dark:text-slate-300 font-bold leading-relaxed whitespace-pre-wrap text-sm">
                              {generatedDesign.siteAnalysis}
                           </p>
                        </div>
                        
                        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl overflow-hidden relative">
                           <div className="absolute -right-4 -top-4 opacity-5"><LinkIcon size={120} /></div>
                           <h3 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3 mb-6">
                              <LinkIcon className="text-indigo-400" /> Reference Logic
                           </h3>
                           <div className="space-y-4">
                              {siteDiscovery?.references.map((ref, i) => (
                                 <a key={i} href={ref.uri} target="_blank" rel="noreferrer" className="block p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Reference {i+1}</span>
                                    <span className="text-xs font-bold truncate block">{ref.title}</span>
                                 </a>
                              ))}
                           </div>
                        </div>
                     </div>

                     <CostAnalysis data={generatedDesign.costs} />
                  </div>
                  
                  <div className="space-y-6 sm:space-y-12">
                     <div className="bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[3.5rem] shadow-xl backdrop-blur-md lg:sticky lg:top-32">
                        <h3 className="text-xl sm:text-2xl font-black mb-6 sm:mb-8 italic">Spatial Analysis</h3>
                        <div className="space-y-4 sm:space-y-6 max-h-[300px] lg:max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                           {generatedDesign.floorPlanJson?.rooms?.map((r, i) => (
                             <div key={i} className="flex justify-between items-start border-b border-black/5 dark:border-white/5 pb-4">
                               <div className="max-w-[80%]">
                                 <span className="block font-black text-sm sm:text-base tracking-tight">{r.name}</span>
                                 <span className="text-[8px] sm:text-[10px] text-slate-400 font-black uppercase">{r.size}</span>
                               </div>
                               <Info className="w-4 h-4 text-slate-300 flex-shrink-0" />
                             </div>
                           ))}
                        </div>
                        <button onClick={() => setChatOpen(true)} className={`${isDark ? 'bg-navy-950 text-white' : 'bg-slate-900 text-white'} w-full py-4 sm:py-5 rounded-3xl font-black text-base sm:text-lg mt-8 sm:mt-12 active:scale-95 transition-transform`}>Consult Lead Architect</button>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {viewMode === 'dashboard' && (
          <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 md:p-12 animate-in fade-in">
             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-12 sm:mb-16">
               <h2 className="text-3xl sm:text-4xl font-black uppercase italic tracking-tighter">Studio Nodes</h2>
               <button onClick={() => setViewMode('landing')} className={`${currentTheme.primary} w-full sm:w-auto text-white px-8 py-3.5 rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 shadow-xl transition-all`}><Plus className="w-5 h-5" /> New Design</button>
             </div>
             
             {projects.length === 0 ? (
               <div className="bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-[2.5rem] sm:rounded-[3.5rem] p-16 sm:p-32 text-center flex flex-col items-center">
                 <Focus className="w-12 h-12 sm:w-16 sm:h-16 text-slate-300 mb-6 sm:mb-8" />
                 <h3 className="text-xl sm:text-2xl font-bold text-slate-400 mb-6 sm:mb-8 italic">No nodes detected.</h3>
                 <button onClick={() => setViewMode('landing')} className={`border-2 ${currentTheme.border} ${currentTheme.text} px-8 sm:px-10 py-3 sm:py-4 rounded-2xl font-black uppercase text-[10px] active:bg-slate-50 transition-colors`}>Capture Site</button>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                 {projects.map(p => (
                   <div key={p.id} onClick={() => { setGeneratedDesign(p); setCurrentCostData(p.costs); setViewMode('detail'); }} className="bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden hover:scale-[1.03] transition-all cursor-pointer shadow-lg group active:scale-95">
                     <div className="aspect-[16/10] relative">
                        <img src={p.visualizations?.exterior} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt={p.name} />
                        <div className="absolute top-4 left-4 bg-black/60 text-white text-[8px] px-3 py-1 rounded-full font-black uppercase">{p.preferences.style}</div>
                     </div>
                     <div className="p-6 sm:p-8">
                        <h4 className="text-lg sm:text-xl font-black mb-2 italic tracking-tight">{p.name}</h4>
                        <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">{p.floorPlanJson?.totalArea} • {new Date(p.createdAt).toLocaleDateString()}</span>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}
      </main>

      {/* Responsive Chat Overlay */}
      <div className={`fixed inset-x-0 bottom-0 lg:bottom-10 lg:right-10 lg:left-auto z-[200] transition-all transform duration-500 ${chatOpen ? 'translate-y-0 opacity-100' : 'translate-y-full lg:translate-y-20 opacity-0 pointer-events-none'}`}>
          <div className="w-full lg:w-[450px] h-[85vh] lg:h-[700px] bg-white dark:bg-navy-950 border-t lg:border border-black/10 dark:border-white/10 rounded-t-[2.5rem] lg:rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden">
             <div className={`${currentTheme.primary} p-6 lg:p-8 text-white flex justify-between items-center flex-shrink-0`}>
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl"><Sparkles size={18} /></div>
                  <div>
                    <h4 className="text-lg lg:text-xl font-black uppercase italic tracking-tighter">Architect AI</h4>
                    <span className="text-[8px] font-bold tracking-[0.2em] opacity-70">Expert Consultant</span>
                  </div>
                </div>
                <button onClick={() => setChatOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X /></button>
             </div>
             
             <div className="flex-1 p-4 lg:p-6 overflow-y-auto space-y-6 custom-scrollbar text-slate-900 dark:text-slate-100">
                {chatHistory.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10">
                    <div className="bg-slate-100 dark:bg-white/5 p-6 rounded-[2rem] mb-6">
                      <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">How can I help?</p>
                      <p className="text-sm font-bold text-slate-500">I can guide you through architectural logic or provide developer support.</p>
                    </div>
                    
                    <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-6 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/20 w-full">
                       <h5 className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-4 text-center">Developer Profile: Ivan Owusu</h5>
                       <div className="grid grid-cols-2 gap-3">
                          <a href="mailto:ivanowusu3@gmail.com" className="flex items-center gap-2 p-2 bg-white dark:bg-white/5 rounded-xl border border-black/5 hover:border-indigo-500 transition-colors">
                             <Mail size={12} className="text-indigo-400" />
                             <span className="text-[9px] font-bold">Email</span>
                          </a>
                          <a href="tel:+233548403607" className="flex items-center gap-2 p-2 bg-white dark:bg-white/5 rounded-xl border border-black/5 hover:border-indigo-500 transition-colors">
                             <Phone size={12} className="text-indigo-400" />
                             <span className="text-[9px] font-bold">Call</span>
                          </a>
                          <a href="https://www.linkedin.com/in/ivan-owusu/" target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-white dark:bg-white/5 rounded-xl border border-black/5 hover:border-indigo-500 transition-colors">
                             <Linkedin size={12} className="text-indigo-400" />
                             <span className="text-[9px] font-bold">LinkedIn</span>
                          </a>
                          <a href="https://x.com/Ivantheson95" target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-white dark:bg-white/5 rounded-xl border border-black/5 hover:border-indigo-500 transition-colors">
                             <Twitter size={12} className="text-indigo-400" />
                             <span className="text-[9px] font-bold">X</span>
                          </a>
                       </div>
                    </div>
                  </div>
                )}
                {chatHistory.map((h, i) => (
                  <div key={i} className={`flex ${h.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%] space-y-2">
                      <div className={`p-4 lg:p-5 rounded-[1.5rem] lg:rounded-[2rem] font-medium text-sm leading-relaxed ${h.role === 'user' ? `${currentTheme.primary} text-white` : 'bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-300'}`}>{h.content}</div>
                      {h.sources && h.sources.length > 0 && <div className="flex flex-wrap gap-1 lg:gap-2">{h.sources.map((s, idx) => <a key={idx} href={s} target="_blank" rel="noreferrer" className="bg-slate-200 dark:bg-white/10 px-2 lg:px-3 py-1 rounded-full text-[7px] lg:text-[8px] font-black uppercase tracking-widest"><ExternalLink className="w-2.5 h-2.5 inline mr-1" /> Ref {idx + 1}</a>)}</div>}
                    </div>
                  </div>
                ))}
             </div>
             
             <div className="p-4 lg:p-6 border-t border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 flex-shrink-0">
                <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar mb-2 whitespace-nowrap scroll-smooth">
                   {FAQS.map((faq, i) => (
                     <button key={i} onClick={() => handleSendMessage(faq)} className="bg-white dark:bg-white/10 px-4 py-2 rounded-full border border-black/5 text-[9px] font-black uppercase tracking-widest hover:border-indigo-500 transition-colors active:scale-95">
                        {faq}
                     </button>
                   ))}
                </div>
                <div className="flex gap-3">
                  <input value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} onKeyDown={(e) => {
                    if (e.key === 'Enter' && chatMessage.trim()) handleSendMessage(chatMessage);
                  }} placeholder="Ask architectural consultant..." className="flex-1 bg-white dark:bg-white/10 p-4 rounded-xl lg:rounded-2xl outline-none font-medium shadow-sm" />
                  <button onClick={() => handleSendMessage(chatMessage)} className={`${currentTheme.primary} p-4 rounded-xl lg:rounded-2xl text-white active:scale-90 transition-all shadow-lg`}><Send className="w-5 h-5" /></button>
                </div>
             </div>
          </div>
      </div>

      {!chatOpen && (
        <button onClick={() => setChatOpen(true)} className={`fixed bottom-6 right-6 lg:bottom-10 lg:right-10 z-[201] ${currentTheme.primary} p-5 sm:p-6 rounded-full text-white shadow-2xl hover:scale-110 active:scale-90 transition-all shadow-black/20`}>
          <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8" />
        </button>
      )}

      {isVoiceConsultOpen && (
        <div className="fixed inset-0 z-[1000] bg-white/95 dark:bg-navy-950/95 flex flex-col items-center justify-center p-6 animate-in fade-in">
           <div className="mb-12 sm:mb-20 text-center">
              <div className={`${currentTheme.bg} p-10 sm:p-12 rounded-full border ${currentTheme.border} mb-6 sm:mb-8 inline-block shadow-2xl animate-pulse`}>
                <Mic className={`w-16 h-16 sm:w-20 sm:h-20 ${currentTheme.text}`} />
              </div>
              <h2 className="text-4xl sm:text-6xl font-black italic tracking-tighter uppercase">Link Active</h2>
              <p className="text-slate-500 font-black uppercase tracking-[0.4em] text-[8px] sm:text-[10px] mt-4">Consultant Node Open</p>
           </div>
           <div className="flex gap-2 sm:gap-4 items-end h-16 sm:h-24">
              {[...Array(10)].map((_, i) => <div key={i} className={`w-2 sm:w-2.5 ${currentTheme.primary} rounded-full animate-voice-bar`} style={{ animationDelay: `${i * 0.1}s`, height: `${30 + Math.random() * 70}%` }} />)}
           </div>
           <button onClick={stopVoiceSession} className="mt-16 sm:mt-20 border-2 border-black/10 dark:border-white/10 px-10 sm:px-12 py-4 sm:py-5 rounded-[2rem] font-black text-slate-400 uppercase tracking-widest text-[8px] sm:text-[10px] active:bg-slate-50 transition-colors">Terminate Node</button>
        </div>
      )}

      <footer className="py-12 sm:py-20 px-6 sm:px-8 border-t border-black/5 dark:border-white/5 bg-white dark:bg-navy-950/50 text-center">
         <div className="flex justify-center mb-8 opacity-40"><Logo /></div>
         <p className="text-slate-400 dark:text-slate-600 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.5em] opacity-40 leading-relaxed">Imaginebuild Architectural OS • Core v3.5.0<br />Free Tier Optimized Protocol</p>
      </footer>
    </div>
  );
};

export default App;