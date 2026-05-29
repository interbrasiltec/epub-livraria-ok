import React, { useState, useEffect, useCallback } from "react";
import { FolderPlus, RefreshCw, Search, Book, BookOpen, Clock, Filter, ChevronRight, X, Info, Trash2, RotateCcw, Star, Menu, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { get, set, keys, del } from "idb-keyval";
import { BookMetadata, FolderHandle } from "./types";
import { parseEpubMetadata } from "./lib/epub-parser";
import { cn } from "./lib/utils";
import { normalizeSearchTerm, parseGeminiResponse, callGeminiDirectly } from "./services/bookApi";

// --- Components ---

const Rating = ({ rating, count }: { rating?: number, count?: number }) => {
  if (!rating) return null;
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  return (
    <div className="flex items-center gap-1.5" title={`${rating} estrelas (${count || 0} avaliações)`}>
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star 
            key={i} 
            size={12} 
            className={cn(
              "transition-colors",
              i < fullStars ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_2px_rgba(251,191,36,0.5)]" : 
              (i === fullStars && hasHalfStar) ? "fill-amber-400/50 text-amber-400" : "text-gray-700"
            )} 
          />
        ))}
      </div>
      <span className="text-[10px] font-bold text-amber-400/90">{rating.toFixed(1)}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] text-gray-600 font-medium lowercase">
          ({count >= 1000000 ? `${(count/1000000).toFixed(1)}M` : count >= 1000 ? `${(count/1000).toFixed(1)}k` : count} avaliações)
        </span>
      )}
    </div>
  );
};

const UploadMenu = ({ onAddFolder, onAddFiles, align = "bottom" }: { onAddFolder: () => void, onAddFiles: () => void, align?: "top" | "bottom" }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-amber-950/50"
      >
        <FolderPlus size={14} />
        UPLOAD
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: align === "top" ? 10 : -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: align === "top" ? 10 : -10, scale: 0.95 }}
              className={cn(
                "absolute left-0 w-48 bg-[#221a14] border border-[#3b2d24] rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.6)] z-20",
                align === "top" ? "top-full mt-2" : "bottom-full mb-2"
              )}
            >
              <button 
                onClick={() => { onAddFiles(); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-[#e2d5c5] hover:bg-amber-950/40 transition-colors text-xs font-medium border-b border-[#3b2d24]"
              >
                <Book size={14} className="text-accent-blue" />
                Arquivos Avulsos
              </button>
              <button 
                onClick={() => { onAddFolder(); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-[#e2d5c5] hover:bg-amber-950/40 transition-colors text-xs font-medium"
              >
                <FolderPlus size={14} className="text-accent-blue" />
                Pasta Inteira
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

function ElegantLibrarySprout({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 100 120" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M38 75 L62 75 L64 94 A3 3 0 0 1 61 97 L39 97 A3 3 0 0 1 36 94 Z" fill="#8e4922" opacity="0.95" />
      <path d="M33 71 H67 V75 H33 Z" fill="#713511" />
      <path d="M50 73 C46 87, 49 98, 42 108" stroke="#415a44" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M52 73 C59 84, 55 95, 60 104" stroke="#415a44" strokeWidth="1.2" strokeLinecap="round" />
      <polygon points="41,80 34,79 38,85" fill="#4f7156" />
      <polygon points="56,83 62,81 58,88" fill="#3a533e" />
      <polygon points="38,92 31,93 36,98" fill="#587d60" />
      <polygon points="58,91 64,90 60,96" fill="#324735" />
      <polygon points="42,101 37,103 41,107" fill="#4f7156" />
    </svg>
  );
}

function CozyHangingIvy({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Branch stem lines */}
      <path d="M10 0 C15 50, 5 100, 18 160 C25 210, 12 280, 22 350 C24 370, 18 390, 20 400" stroke="#253528" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
      <path d="M40 0 C30 80, 50 160, 35 240 C25 310, 42 370, 38 400" stroke="#1f2d22" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <path d="M80 0 C90 70, 75 180, 85 270 C92 320, 80 380, 84 400" stroke="#18231a" strokeWidth="1.2" strokeLinecap="round" opacity="0.75" />
      
      {/* Vine Leaves */}
      {/* Vine 1 leaves */}
      <path d="M10 30 Q-5 25, -2 40 Z" fill="#2d3d30" /> <path d="M10 30 Q22 20, 18 35 Z" fill="#1f2c21" />
      <path d="M12 80 Q0 70, 2 85 Z" fill="#384e3c" /> <path d="M12 80 Q25 75, 20 90 Z" fill="#28382b" />
      <path d="M8 130 Q-6 125, -2 140 Z" fill="#425d48" /> <path d="M8 130 Q22 120, 16 135 Z" fill="#384e3c" />
      <path d="M16 190 Q2 185, 6 200 Z" fill="#2d3d30" /> <path d="M16 190 Q30 180, 26 195 Z" fill="#1f2c21" />
      <path d="M18 250 Q6 245, 10 260 Z" fill="#425d48" /> <path d="M18 250 Q32 240, 28 255 Z" fill="#2d3d30" />
      <path d="M14 310 Q2 305, 6 320 Z" fill="#384e3c" /> <path d="M14 310 Q28 300, 24 315 Z" fill="#28382b" />
      <path d="M22 370 Q10 365, 14 380 Z" fill="#2d3d30" /> <path d="M22 370 Q36 360, 32 375 Z" fill="#1f2c21" />

      {/* Vine 2 leaves */}
      <path d="M40 50 Q25 45, 28 60 Z" fill="#28382b" /> <path d="M40 50 Q55 40, 50 55 Z" fill="#1f2c21" />
      <path d="M45 120 Q30 115, 33 130 Z" fill="#384e3c" /> <path d="M45 120 Q60 110, 55 125 Z" fill="#2d3d30" />
      <path d="M38 200 Q22 195, 26 210 Z" fill="#425d48" /> <path d="M38 200 Q52 190, 48 205 Z" fill="#28382b" />
      <path d="M36 290 Q20 285, 24 300 Z" fill="#2d3d30" /> <path d="M36 290 Q50 280, 46 295 Z" fill="#1f2c21" />
      <path d="M40 370 Q25 365, 28 380 Z" fill="#384e3c" /> <path d="M40 370 Q55 360, 50 375 Z" fill="#2d3d30" />
      
      {/* Vine 3 leaves */}
      <path d="M80 40 Q65 35, 68 50 Z" fill="#1f2c21" /> <path d="M80 40 Q95 30, 90 45 Z" fill="#162018" />
      <path d="M84 110 Q68 105, 72 120 Z" fill="#2d3d30" /> <path d="M84 110 Q98 100, 94 115 Z" fill="#28382b" />
      <path d="M82 180 Q66 175, 70 190 Z" fill="#384e3c" /> <path d="M82 180 Q96 170, 92 185 Z" fill="#2d3d30" />
      <path d="M85 260 Q69 255, 73 270 Z" fill="#425d48" /> <path d="M85 260 Q99 250, 95 265 Z" fill="#28382b" />
      <path d="M83 340 Q67 335, 71 350 Z" fill="#2d3d30" /> <path d="M83 340 Q97 330, 93 345 Z" fill="#1f2c21" />
    </svg>
  );
}

function CozyLibraryLamp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Support hanger and base chain */}
      <path d="M50 0 V30" stroke="#785935" strokeWidth="2.5" />
      
      {/* Bulb glow aura */}
      <circle cx="50" cy="55" r="30" fill="url(#lamp_glow)" opacity="0.8" className="animate-pulse" style={{ animationDuration: '5s' }} />
      
      {/* Glowing filament/bulb */}
      <circle cx="50" cy="55" r="6" fill="#fff5d6" />
      
      {/* Lampshade (Traditional flared fabric cone) */}
      <path d="M30 30 L15 65 H85 L70 30 Z" fill="#4d321d" stroke="#6b4c27" strokeWidth="2.5" />
      {/* Inner shade reflection */}
      <path d="M18 64 C35 69, 65 69, 82 64" stroke="#ffcb6b" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 32 L20 62" stroke="#372414" strokeWidth="1" />
      <path d="M68 32 L80 62" stroke="#372414" strokeWidth="1" />
      
      <defs>
        <radialGradient id="lamp_glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb845" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#e0861b" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e0861b" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function CozyCandleLantern({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Dynamic fire glow */}
      <circle cx="40" cy="85" r="38" fill="url(#lantern_glow)" opacity="0.75" className="animate-pulse" style={{ animationDuration: '3.5s' }} />
      
      {/* Black carbonized iron frame */}
      <path d="M22 60 H58 V118 H22 Z" fill="none" stroke="#1c130e" strokeWidth="3.5" />
      <path d="M18 118 H62 V124 H18 Z" fill="#120b08" />
      
      {/* Pyramid style iron roof top & carrying loop */}
      <path d="M18 60 L40 34 L62 60 Z" fill="#1c130e" />
      <circle cx="40" cy="24" r="6" fill="none" stroke="#1c130e" strokeWidth="2.5" />
      
      {/* Candle wax body */}
      <path d="M33 88 H47 V114 H33 Z" fill="#ebdfd0" />
      <ellipse cx="40" cy="88" rx="7" ry="2" fill="#fffcf7" />
      
      {/* Dancing flickery flame */}
      <path d="M40 70 C38 75, 37 81, 40 85 C43 81, 42 75, 40 70 Z" fill="#ff9100" />
      <path d="M40 73 C39 76, 38 80, 40 84 C42 80, 41 76, 40 73 Z" fill="#ffd54f" />
      
      <defs>
        <radialGradient id="lantern_glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff9100" stopOpacity="0.9" />
          <stop offset="35%" stopColor="#e65100" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#e65100" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

const SidebarLeft = ({ 
  folderHandles, 
  onAddFolder, 
  onAddFiles,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  onRemoveFolder,
  onEmptyTrash,
  trashCount,
  isOpen,
  onClose,
  userApiKey,
  onUserApiKeyChange,
  onTestGemini
}: { 
  folderHandles: FolderHandle[], 
  onAddFolder: () => void,
  onAddFiles: () => void,
  viewMode: "library" | "trash",
  setViewMode: (v: "library" | "trash") => void,
  sortBy: "title" | "author" | "date",
  setSortBy: (v: "title" | "author" | "date") => void,
  onRemoveFolder: (id: string) => void,
  onEmptyTrash: () => void,
  trashCount: number,
  isOpen: boolean,
  onClose: () => void,
  userApiKey: string,
  onUserApiKeyChange: (key: string) => void,
  onTestGemini?: () => void
}) => {
  const [tempKey, setTempKey] = useState(userApiKey);

  useEffect(() => {
    setTempKey(userApiKey);
  }, [userApiKey]);

  const handleSaveKey = () => {
    onUserApiKeyChange(tempKey.trim());
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />
        )}
      </AnimatePresence>

      <motion.aside 
        initial={false}
        animate={{ x: isOpen ? 0 : -260 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed top-0 left-0 bottom-0 w-64 bg-bg-sidebar-left border-r border-[#2d221a] flex flex-col h-[100dvh] overflow-hidden shrink-0 z-[70] shadow-2xl"
      >
        <div className="p-6 flex items-center justify-between relative overflow-hidden border-b border-[#2d221a]/60">
          {/* Subtle botanical sprout decorating Left Sidebar corner */}
          <ElegantLibrarySprout className="absolute -top-2 -right-1 w-12 h-14 opacity-50 pointer-events-none" />
          <h1 className="text-xl font-serif font-bold text-accent-blue flex items-center gap-2 relative z-10">
            <BookOpen className="w-6 h-6 text-accent-blue" />
            Ebookpedia
          </h1>
          <button onClick={onClose} className="p-2 hover:bg-[#2d221a]/40 rounded-full text-stone-500 transition-colors relative z-10">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
        </div>
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-3 mt-4">Biblioteca</div>
          
          <div className="px-3 py-2 bg-black/20 rounded-lg mb-4 space-y-2">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Ordenar por</div>
            <div className="flex flex-wrap gap-1">
              <button 
                onClick={() => { setSortBy("title"); setViewMode("library"); }}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold transition-all",
                  sortBy === "title" ? "bg-accent-blue text-white" : "bg-white/5 text-gray-500 hover:text-gray-300"
                )}
              >
                A-Z
              </button>
              <button 
                onClick={() => { setSortBy("author"); setViewMode("library"); }}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold transition-all",
                  sortBy === "author" ? "bg-accent-blue text-white" : "bg-white/5 text-gray-500 hover:text-gray-300"
                )}
              >
                Autor
              </button>
              <button 
                onClick={() => { setSortBy("date"); setViewMode("library"); }}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold transition-all",
                  sortBy === "date" ? "bg-accent-blue text-white" : "bg-white/5 text-gray-500 hover:text-gray-300"
                )}
              >
                Recentes
              </button>
            </div>
          </div>

          <button 
            onClick={() => { setViewMode("library"); onClose(); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors text-sm",
              viewMode === "library" ? "bg-accent-blue/20 text-accent-blue" : "text-gray-400 hover:bg-white/5"
            )}
          >
            <Book className="w-4 h-4" />
            Minha Estante
          </button>

          <button 
            onClick={() => { setViewMode("trash"); onClose(); }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-md font-medium transition-colors text-sm mt-4",
              viewMode === "trash" ? "bg-red-500/20 text-red-500" : "text-gray-400 hover:bg-white/5"
            )}
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-4 h-4" />
              Lixeira
            </div>
            {trashCount > 0 && <span className="text-[10px] bg-red-500/20 px-1.5 py-0.5 rounded-full">{trashCount}</span>}
          </button>

          {trashCount > 0 && (
            <button 
              onClick={onEmptyTrash}
              className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors text-xs font-bold mt-2 animate-fade-in"
            >
              <X className="w-4 h-4" />
              Esvaziar Lixeira
            </button>
          )}

          <div className="mt-8 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-3">Ações</div>
          <div className="px-3">
            <UploadMenu onAddFolder={onAddFolder} onAddFiles={onAddFiles} />
          </div>

          <div className="mt-8 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-3 animate-pulse">Configuração IA</div>
          <div className="px-3 pb-2">
            <div className="bg-black/20 p-2.5 rounded-lg border border-amber-950/20">
              <span className="text-[10px] text-gray-400 block mb-1.5 font-bold uppercase tracking-wide">Chave API Gemini</span>
              <div className="flex gap-1.5 items-center mb-2">
                <input 
                  type="password" 
                  placeholder="Cole sua chave (PWA)..." 
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  className="bg-[#241c16] border-none rounded px-2 py-1 text-[11px] flex-1 focus:ring-1 focus:ring-accent-blue text-stone-200 transition-all placeholder-stone-600"
                />
                {tempKey !== userApiKey && (
                  <button 
                    onClick={handleSaveKey}
                    className="bg-accent-blue hover:bg-accent-blue-hover text-white px-2 py-1 rounded text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                    title="Salvar chave pessoal"
                  >
                    Salvar
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between text-[9px] mt-1">
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className={cn(
                    "w-2 h-2 rounded-full inline-block shrink-0",
                    userApiKey ? "bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]" : "bg-gray-600"
                  )} />
                  {userApiKey ? "Chave Pessoal Salva" : "Usando Servidor"}
                </span>
                {userApiKey && (
                  <button 
                    onClick={() => { onUserApiKeyChange(""); setTempKey(""); }}
                    className="text-red-500 hover:text-red-400 font-bold transition-colors shrink-0 cursor-pointer"
                  >
                    Remover
                  </button>
                )}
              </div>
              
              <div className="mt-3 pt-2.5 border-t border-amber-950/20 flex justify-center">
                <button
                  onClick={onTestGemini}
                  className="w-full text-center bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-2 py-1.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  title="Testar conexão com o modelo Gemini"
                >
                  <Sparkles size={11} className="text-amber-400" />
                  Testar Gemini
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-3">Pastas Monitoradas</div>
          <div className="space-y-1 pb-8">
            {folderHandles.map(f => (
              <div key={f.id} className="flex items-center justify-between px-3 py-1.5 text-xs text-gray-400 hover:bg-white/5 rounded transition-colors group relative">
                <span className="truncate flex-1 mr-2" title={f.name}>{f.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-green-900/40 text-green-400 px-1.5 py-0.5 rounded border border-green-800/50 group-hover:hidden">Ativo</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRemoveFolder(f.id); }}
                    className="hidden group-hover:flex p-1 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded transition-colors"
                    title="Remover pasta"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            {folderHandles.length === 0 && (
              <p className="px-3 text-[10px] text-gray-600 italic">Nenhuma pasta adicionada</p>
            )}
          </div>
        </nav>
        <div className="p-4 bg-black/20 text-[10px] text-gray-500 border-t border-[#2d221a]">
          <div className="flex justify-between mb-1">
            <span>Sincronização</span>
            <span>100%</span>
          </div>
          <div className="w-full bg-[#241c16] h-1 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              className="bg-accent-blue h-full shadow-[0_0_8px_var(--color-accent-blue)]" 
            />
          </div>
          <p className="mt-2 text-center">Biblioteca Sincronizada</p>
        </div>
      </motion.aside>
    </>
  );
};

function BookCard({ 
  book, 
  isSelected, 
  isMultiSelected,
  onClick, 
  onSelectToggle 
}: { 
  book: BookMetadata, 
  isSelected: boolean, 
  isMultiSelected: boolean,
  onClick: () => void, 
  onSelectToggle: (e: React.MouseEvent) => void,
  key?: React.Key 
}) {
  const [imgError, setImgError] = useState(false);
  
  useEffect(() => {
    setImgError(false);
  }, [book.id, book.coverUrl, book.coverData]);

  const coverSrc = (!imgError && (book.coverData || book.coverUrl)) || null;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "relative group cursor-pointer border rounded-xl p-2.5 transition-all duration-300 bg-[#16110d]/50 backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.4)] overflow-hidden",
        isMultiSelected ? "border-accent-blue/60 bg-accent-blue/5 scale-[0.98] shadow-[0_4px_25px_rgba(223,154,68,0.2)]" : 
        isSelected ? "border-accent-blue bg-accent-blue/10 shadow-[0_0_22px_rgba(223,154,68,0.35)] scale-[1.02]" : 
        "border-transparent bg-transparent hover:border-amber-950/40 hover:bg-amber-950/15 hover:shadow-[0_12px_24px_rgba(0,0,0,0.65)] hover:-translate-y-2"
      )}
    >
      {/* Premium modern wood panel with discrete built-in recessed circular LED spotlight */}
      <div className="h-4.5 -mx-2.5 -mt-2.5 mb-2.5 bg-gradient-to-b from-[#18110a] via-[#2c1d13] to-[#120a06] border-b-2 border-amber-950/35 relative z-20 flex items-center justify-center shadow-[0_3px_6px_rgba(0,0,0,0.65)]">
        {/* Mini circular recessed spot cut in the wood */}
        <div className="w-4 h-2 bg-black/90 rounded-full border border-amber-950/45 flex items-center justify-center shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)] relative">
          {/* Circular high-efficiency LED center lens */}
          <div className="w-1.5 h-1 rounded-full bg-[#fff6e6] shadow-[0_0_10px_#ffffff,0_0_15px_rgba(245,158,11,1)] z-40" />
        </div>
      </div>

      {/* Focused down-shining spotlight ray cone (cascade effect) */}
      <div className={cn(
        "absolute top-4 left-1/2 -translate-x-1/2 w-[85%] h-[82%] bg-[linear-gradient(180deg,rgba(251,191,36,0.25)_0%,rgba(245,158,11,0.06)_45%,transparent_100%)] [clip-path:polygon(42%_0%,58%_0%,100%_100%,0%_100%)] blur-[4px] pointer-events-none z-10 transition-all duration-300",
        isSelected ? "opacity-100 scale-102" : "opacity-60 group-hover:opacity-100 group-hover:scale-101"
      )} />
      
      {/* Subtle secondary ambient focal glow directly behind the book jacket */}
      <div className={cn(
        "absolute top-4 left-1/2 -translate-x-1/2 w-48 h-44 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.12)_0%,transparent_75%)] pointer-events-none z-0 transition-opacity duration-300",
        isSelected ? "opacity-100" : "opacity-70 group-hover:opacity-100"
      )} />

      {/* Selection Toggle Area */}
      <div 
        onClick={onSelectToggle}
        className={cn(
          "absolute top-3 left-3 z-30 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
          isMultiSelected 
            ? "bg-accent-blue border-accent-blue text-white shadow-lg" 
            : "border-white/30 bg-black/60 opacity-0 group-hover:opacity-100"
        )}
      >
        {isMultiSelected && <X size={12} className="rotate-45" />}
      </div>

      {/* AI Synchronization Indicator badge - Top Right, matching selection toggle's size */}
      <div 
        className={cn(
          "absolute top-3 right-3 z-30 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-help",
          book.lastEnriched 
            ? "border-amber-500/50 bg-[#1c130e]/95 text-amber-400 shadow-[0_0_10px_rgba(223,154,68,0.4)]" 
            : "border-white/10 bg-black/60 text-stone-600 opacity-0 group-hover:opacity-100"
        )}
        title={book.lastEnriched ? "Sincronizado com a Inteligência Artificial" : "Não sincronizado com a Inteligência Artificial"}
      >
        <Sparkles size={10} className={cn(book.lastEnriched ? "fill-amber-400 animate-pulse" : "")} />
      </div>

      <div onClick={onClick} className="relative cursor-pointer">
        <div className="aspect-[2/3] bg-[#1a110a] rounded-lg overflow-hidden relative shadow-[0_10px_20px_rgba(0,0,0,0.55)] group-hover:shadow-[0_15px_30px_rgba(0,0,0,0.8)] border border-amber-950/20 transition-all duration-350">
          {coverSrc ? (
            <img 
              src={coverSrc} 
              alt={book.title} 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-amber-100/30 font-serif italic text-center p-4 bg-gradient-to-br from-[#241a13] to-[#140c06] text-xs shadow-inner">
              {book.title}
            </div>
          )}

          {/* Hardcover spine visual hinge overlays */}
          <div className="absolute left-0 top-0 bottom-0 w-[6px] bg-gradient-to-r from-black/50 via-black/15 to-transparent pointer-events-none z-10" />
          
          {/* Realistic paper page trim edges on the right */}
          <div className="absolute right-0 top-0 bottom-0 w-[2.5px] bg-gradient-to-l from-amber-500/15 via-white/5 to-transparent pointer-events-none z-10" />
          
          {/* Elegant leather finish spotlight illumination */}
          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none z-10" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent pointer-events-none z-10" />
          
          {/* Laminated glossy diagonal beam glare */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-750 pointer-events-none z-15" />
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 to-transparent flex items-end p-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <span className="text-[9px] font-bold text-accent-blue bg-[#1e140d]/95 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase font-mono">
              {book.fileName.split('.').pop() || 'EPUB'}
            </span>
          </div>
        </div>
        
        {/* Beautiful, realistic 3D Wood Shelf base supporting the book cover above */}
        <div className="h-3.5 -mx-2.5 mt-2.5 mb-1 bg-gradient-to-b from-[#3d2b1e] via-[#24160d] to-[#120a06] border-t border-amber-500/25 rounded-md relative z-20 shadow-[0_5px_8px_rgba(0,0,0,0.65)] flex items-center justify-between px-3">
          {/* Refined brass book-rail rivet pins */}
          <div className="w-[3px] h-[3px] rounded-full bg-amber-500/40 shadow-[0_0_2px_rgba(223,154,68,0.3)] animate-pulse" />
          <span className="w-1/3 h-[1px] bg-gradient-to-r from-transparent via-amber-500/10 to-transparent" />
          <div className="w-[3px] h-[3px] rounded-full bg-amber-500/40 shadow-[0_0_2px_rgba(223,154,68,0.3)] animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

const SidebarRight = ({ 
  book, 
  onClose, 
  onEnrich,
  isEnriching,
  onMoveToTrash,
  onRestore,
  showToastMsg
}: { 
  book: BookMetadata | null, 
  onClose: () => void, 
  onEnrich: () => void,
  isEnriching: boolean,
  onMoveToTrash: (id: string) => void,
  onRestore: (id: string) => void,
  showToastMsg: (msg: string, type: "success" | "error" | "info") => void
}) => {
  const [imgError, setImgError] = useState(false);

  // Reset image error state when book changes
  useEffect(() => {
    setImgError(false);
  }, [book?.id]);

  // On tablet and desktop, show the placeholder sidebar
  if (!book) return (
    <aside className="hidden md:flex w-80 bg-bg-sidebar-right border-l border-[#2d221a] flex-col items-center justify-center p-8 text-center text-stone-500 shrink-0">
      <BookOpen className="w-12 h-12 mb-4 opacity-5 text-accent-blue" />
      <p className="text-xs uppercase tracking-widest font-semibold text-stone-600">Selecione um livro</p>
    </aside>
  );

  const coverSrc = (!imgError && (book.coverData || book.coverUrl)) || null;

  return (
    <>
      <AnimatePresence>
        {book && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside 
        initial={{ x: 320 }}
        animate={{ x: 0 }}
        exit={{ x: 320 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className={cn(
          "fixed top-0 right-0 bottom-0 w-full sm:w-80 bg-bg-sidebar-right border-l border-[#2d221a] flex flex-col z-[70] shadow-2xl h-[100dvh] md:h-full overflow-hidden shrink-0",
          "md:relative md:translate-x-0 md:shadow-none md:z-0"
        )}
      >
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar relative">
          {/* Delicate hanging botanical spout on the right sidebar corner */}
          <ElegantLibrarySprout className="absolute -top-1 -right-1 w-12 h-14 opacity-50 pointer-events-none" />

          <div className="relative">
            <div className={cn(
              "aspect-[2/3] w-full rounded-lg shadow-[0_15px_35px_rgba(0,0,0,0.65)] flex items-center justify-center border border-accent-blue/15 relative overflow-hidden bg-[#1a110a]",
              !coverSrc && "bg-[#241a13]"
            )}>
              {coverSrc ? (
                <img 
                  src={coverSrc} 
                  className="w-full h-full object-contain" 
                  alt={book.title} 
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <span className="text-xl font-serif text-white/50 italic text-center p-4">
                    {book.title}
                  </span>
                  {book.coverUrl && !book.coverData && (
                    <button 
                      onClick={onEnrich}
                      disabled={isEnriching}
                      className="text-[10px] bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      <RefreshCw size={10} />
                      Tentar outra capa
                    </button>
                  )}
                </div>
              )}
              {/* Hardcover spine visual hinges in details view */}
              <div className="absolute left-0 top-0 bottom-0 w-[7px] bg-gradient-to-r from-black/60 via-black/20 to-transparent pointer-events-none z-10" />
              {/* Golden page edges highlight */}
              <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-gradient-to-l from-amber-500/20 via-white/5 to-transparent pointer-events-none z-10" />
            </div>

            {/* Custom crafted 3D mahogany shelf plate for details book jacket */}
            <div className="h-4 w-full bg-gradient-to-b from-[#422e1f] via-[#2a1b11] to-[#120a06] border-t-2 border-amber-500/30 rounded-md relative z-20 mt-1 mb-6 shadow-[0_6px_12px_rgba(0,0,0,0.7)] flex items-center justify-between px-3.5">
              {/* Vintage library label plate rivets */}
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500/40 shadow-[0_0_2px_rgba(223,154,68,0.4)]" />
              <span className="w-1/4 h-[1px] bg-gradient-to-r from-transparent via-amber-500/15 to-transparent" />
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500/40 shadow-[0_0_2px_rgba(223,154,68,0.4)]" />
            </div>
          </div>
        
        <div className="mb-6">
          <div className="flex justify-between items-start gap-2 mb-1">
            <h2 className="text-xl font-bold text-white leading-tight">{book.title}</h2>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-full text-gray-500 hover:text-gray-300"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-accent-blue font-medium text-sm">{book.author}</p>
            <Rating rating={book.rating} count={book.ratingCount} />
          </div>
        </div>

        {/* AI Synchronization Status Bar */}
        <div className="mb-6 p-3.5 rounded-xl bg-[#241a13]/30 border border-amber-950/45 flex items-center justify-between shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className={cn(
              "transition-all duration-500",
              book.lastEnriched ? "text-amber-400 fill-amber-400 animate-pulse" : "text-stone-500"
            )} />
            <span className="text-[10px] text-stone-400 font-serif font-bold uppercase tracking-widest">Status da I.A.</span>
          </div>
          {book.lastEnriched ? (
            <span className="text-[10px] px-2.5 py-0.5 rounded-md font-bold bg-amber-500/10 border border-amber-500/25 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
              Sincronizado
            </span>
          ) : (
            <span className="text-[10px] px-2.5 py-0.5 rounded-md font-bold bg-[#140c06] border border-stone-800 text-stone-500">
              Aguardando IA
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-8">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">Gênero</p>
            <p className="text-xs font-semibold text-gray-300 truncate">{book.genre || "---"}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">Páginas</p>
            <p className="text-xs font-semibold text-gray-300 truncate">{book.pageCount || "---"}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">Publicação</p>
            <p className="text-xs font-semibold text-gray-300 truncate">{book.publicationDate || "---"}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">Editora</p>
            <p className="text-xs font-semibold text-gray-300 truncate">{book.publisher || "---"}</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">Sinopse</p>
          <p className="text-xs text-gray-400 leading-relaxed italic">
            {book.synopsis || "Nenhuma sinopse disponível. Sincronize para buscar metadados."}
          </p>
        </div>

        {book.youtubeVideoId && (
          <div className="mb-6">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">Resenha / Vídeo</p>
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-black shadow-lg border border-white/5">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${book.youtubeVideoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 pt-2 border-t border-[#2d221a] bg-black/20 flex flex-col gap-2 shrink-0 safe-pb">
        {book.inTrash ? (
          <button 
            onClick={() => onRestore(book.id)}
            className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-2.5 px-4 rounded transition-all text-xs flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Restaurar da Lixeira
          </button>
        ) : (
          <button 
            onClick={() => onEnrich()}
            disabled={isEnriching}
            className="w-full bg-accent-blue hover:bg-accent-blue-hover disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50"
          >
            {isEnriching ? <RefreshCw className="animate-spin w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            Sincronizar Informações
          </button>
        )}
        
        <button 
          onClick={() => book.inTrash ? showToastMsg("Para remover permanentemente, esvazie a lixeira.", "info") : onMoveToTrash(book.id)}
          className={cn(
            "w-full font-bold py-2 rounded transition-all text-[10px] flex items-center justify-center gap-2",
            book.inTrash ? "text-gray-600 cursor-not-allowed" : "text-gray-500 hover:text-red-400 hover:bg-red-500/10"
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {book.inTrash ? "Item na Lixeira" : "Mover para Lixeira"}
        </button>
      </div>
      </motion.aside>
    </>
  );
};


// --- App ---

export default function App() {
  const [books, setBooks] = useState<BookMetadata[]>([]);
  const [folderHandles, setFolderHandles] = useState<FolderHandle[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookMetadata | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [tempSearchQuery, setTempSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "author" | "date">("date");
  const [viewMode, setViewMode] = useState<"library" | "trash">("library");

  const [isSyncing, setIsSyncing] = useState(false);
  const isEnriching = isSyncing;
  const [showIframeNotice, setShowIframeNotice] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userApiKey, setUserApiKey] = useState<string>("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToastMsg = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    // Auto clear after 6 seconds
    setTimeout(() => {
      setToast(prev => prev?.message === message ? null : prev);
    }, 6000);
  };

  // Check if running in iframe
  useEffect(() => {
    const isIframe = window.self !== window.top;
    if (isIframe) {
      setShowIframeNotice(true);
    }
  }, []);

  // Load state from IndexedDB
  useEffect(() => {
    async function loadData() {
      const storedBooks = await get("books") || [];
      const storedFolders = await get("folders") || [];
      const storedApiKey = await get("gemini_api_key") || "";
      setBooks(storedBooks);
      setFolderHandles(storedFolders);
      setUserApiKey(storedApiKey as string);
    }
    loadData();
  }, []);

  const handleUserApiKeyChange = async (key: string) => {
    setUserApiKey(key);
    if (key) {
      await set("gemini_api_key", key);
    } else {
      await del("gemini_api_key");
    }
  };

  // Migration: Ensure all books have importedAt
  useEffect(() => {
    if (books.length > 0) {
      const needsMigration = books.some(b => !b.importedAt);
      if (needsMigration) {
        setBooks(prev => prev.map(b => b.importedAt ? b : { ...b, importedAt: Date.now() }));
      }
      set("books", books);
    }
  }, [books]);

  // Save folders to IndexedDB when they change
  useEffect(() => {
    if (folderHandles.length > 0) {
      set("folders", folderHandles);
    }
  }, [folderHandles]);

  const addFolder = async () => {
    try {
      // @ts-ignore - File System Access API
      if (!window.showDirectoryPicker) {
        showToastMsg("Seu navegador não suporta a seleção de pastas. Tente usar o Chrome no Desktop.", "error");
        return;
      }
      
      // @ts-ignore - File System Access API
      const handle = await window.showDirectoryPicker();
      const newFolder: FolderHandle = {
        id: crypto.randomUUID(),
        name: handle.name,
        handle: handle
      };
      
      setFolderHandles(prev => [...prev, newFolder]);
      await scanFolder(handle);
    } catch (err: any) {
      console.error("Error choosing folder:", err);
      if (err.name === 'SecurityError' || err.message.includes('sub frames')) {
        setShowIframeNotice(true);
      }
    }
  };

  const addFiles = async () => {
    // Helper function to process standard File list (from input fallback or picker)
    const processFileList = async (files: FileList | File[]) => {
      setIsScanning(true);
      const foundBooks: BookMetadata[] = [];
      const now = Date.now();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const name = file.name;
        // Verify supported formats
        if (!/\.(epub|pdf|mobi)$/i.test(name)) {
          continue;
        }

        const exists = books.some(b => b.fileName === name);
        if (!exists) {
          try {
            console.log(`[Import] Processando arquivo: "${name}" (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
            let metadata;
            try {
              metadata = await parseEpubMetadata(file);
            } catch (pErr: any) {
              console.warn(`[EPUB Parser] Erro ao obter metadados de "${name}", usando fallback de nome:`, pErr);
              metadata = {
                title: name.replace(/\.(epub|pdf|mobi)$/i, ""),
                author: "Desconhecido",
                fileName: name
              };
            }

            foundBooks.push({
              ...metadata,
              id: crypto.randomUUID(),
              fileName: name,
              filePath: name,
              title: metadata.title || name.replace(/\.(epub|pdf|mobi)$/i, ""),
              author: metadata.author || "Desconhecido",
              importedAt: now,
            } as BookMetadata);
          } catch (err: any) {
            console.error(`Erro ao importar "${name}":`, err);
          }
        }
      }

      if (foundBooks.length > 0) {
        setBooks(prev => {
          const merged = [...prev];
          for (const fb of foundBooks) {
            if (!merged.some(b => b.fileName === fb.fileName)) {
              merged.push(fb);
            }
          }
          return merged;
        });
        showToastMsg(`${foundBooks.length} livro(s) importado(s) com sucesso!`, "success");
      } else {
        showToastMsg("Nenhum livro novo importado.", "info");
      }
      setIsScanning(false);
    };

    // Standard fallback using input[type="file"]
    const triggerStandardFileInput = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = ".epub,.pdf,.mobi";
      input.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          await processFileList(target.files);
        }
      };
      input.click();
    };

    try {
      // @ts-ignore - File System Access API
      if (!window.showOpenFilePicker) {
        console.log("[Import] showOpenFilePicker não disponível, usando seletor padrão de input de arquivos.");
        triggerStandardFileInput();
        return;
      }

      // @ts-ignore - File System Access API
      const fileHandles = await window.showOpenFilePicker({
        multiple: true,
        types: [{
          description: 'Livros Digitais (*.epub, *.pdf, *.mobi)',
          accept: {
            'application/epub+zip': ['.epub'],
            'application/pdf': ['.pdf'],
            'application/x-mobipocket-ebook': ['.mobi']
          }
        }]
      });

      setIsScanning(true);
      const tempFiles: File[] = [];
      for (const handle of fileHandles) {
        try {
          const file = await handle.getFile();
          tempFiles.push(file);
        } catch (fileErr) {
          console.error("Erro ao obter arquivo do handle:", fileErr);
        }
      }

      if (tempFiles.length > 0) {
        await processFileList(tempFiles);
      } else {
        setIsScanning(false);
      }
    } catch (err: any) {
      console.warn("showOpenFilePicker falhou ou foi bloqueado por permissão:", err);
      // Fallback safe option for restricted sandboxes/iframes
      if (err.name === 'SecurityError' || err.message?.includes('sub frames') || err.message?.includes('sandbox')) {
        console.log("[Import] iFrame bloqueou showOpenFilePicker. Redirecionando para input[type='file']...");
        triggerStandardFileInput();
      } else {
        setIsScanning(false);
      }
    }
  };

  const scanFolder = async (dirHandle: FileSystemDirectoryHandle) => {
    setIsScanning(true);
    const foundBooks: BookMetadata[] = [];
    const now = Date.now();
    
    // Recursive scan
    const scan = async (handle: FileSystemDirectoryHandle, path: string = "") => {
      // @ts-ignore
      for await (const [name, entry] of handle.entries()) {
        const fullPath = path ? `${path}/${name}` : name;
        const isSupported = /\.(epub|pdf|mobi)$/i.test(name);
        if (entry.kind === "file" && isSupported) {
          // Check if already in library
          const exists = books.some(b => b.filePath === fullPath && b.fileName === name);
          if (!exists) {
            try {
              const file = await entry.getFile();
              let metadata;
              try {
                metadata = await parseEpubMetadata(file);
              } catch (pErr) {
                console.warn(`[EPUB Parser] Erro ao ler metadados internos de "${name}", usando fallback de nome de arquivo:`, pErr);
                metadata = {
                  title: name.replace(/\.(epub|pdf|mobi)$/i, ""),
                  author: "Desconhecido",
                  fileName: name
                };
              }

              foundBooks.push({
                ...metadata,
                id: crypto.randomUUID(),
                fileName: name,
                filePath: fullPath,
                title: metadata.title || name.replace(/\.(epub|pdf|mobi)$/i, ""),
                author: metadata.author || "Desconhecido",
                importedAt: now,
              } as BookMetadata);
            } catch (err) {
              console.error(`Error parsing file ${name}:`, err);
            }
          }
        } else if (entry.kind === "directory") {
          await scan(entry, fullPath);
        }
      }
    };

    try {
      await scan(dirHandle);
    } catch (scanErr: any) {
      console.error("Erro durante o escaneamento recursivo:", scanErr);
      showToastMsg("Ocorreu um erro ao escanear todos os arquivos da pasta.", "error");
    }
    
    if (foundBooks.length > 0) {
      setBooks(prev => {
        const merged = [...prev];
        for (const fb of foundBooks) {
          if (!merged.some(b => b.filePath === fb.filePath && b.fileName === fb.fileName)) {
            merged.push(fb);
          }
        }
        return merged;
      });
      showToastMsg(`${foundBooks.length} livro(s) encontrado(s) e adicionado(s)!`, "success");
    } else {
      showToastMsg("Nenhum livro novo encontrado na pasta.", "info");
    }
    setIsScanning(false);
  };

  const refreshLibrary = async () => {
    setIsScanning(true);
    for (const folder of folderHandles) {
      try {
        // @ts-ignore - File System Access API permission check
        const permission = await folder.handle.queryPermission({ mode: 'read' });
        if (permission !== 'granted') {
          // @ts-ignore
          const requested = await folder.handle.requestPermission({ mode: 'read' });
          if (requested !== 'granted') continue;
        }
        await scanFolder(folder.handle);
      } catch (err) {
        console.error(`Error refreshing folder ${folder.name}:`, err);
      }
    }
    setIsScanning(false);
  };

  const enrichBook = async (bookId: string) => {
    if (isSyncing) {
      return;
    }

    const book = books.find(b => b.id === bookId);
    if (!book) return;

    setIsSyncing(true);
    console.log("Gemini request iniciada");

    try {
      const data = await callGeminiDirectly(book.title, book.author, book.isbn, book.fileName, userApiKey);

      console.log("Gemini response recebida");
      const now = Date.now();
      const updatedData = { ...data, lastEnriched: now };
      setBooks(prev => prev.map(b => b.id === bookId ? { ...b, ...updatedData } : b));
      setSelectedBook(prev => prev?.id === bookId ? { ...prev, ...updatedData } : prev);
      showToastMsg(`Metadados de "${book.title}" sincronizados com sucesso!`, "success");
      
    } catch (err: any) {
      console.error(`[Sync] Error for ${book.title}:`, err);
      showToastMsg(`Erro ao sincronizar "${book.title}": ${err.message}`, "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const enrichAllBooks = async () => {
    if (isSyncing) {
      return;
    }

    const booksToEnrich = books.filter(b => !b.inTrash && !b.lastEnriched);
    if (booksToEnrich.length === 0) {
      showToastMsg("Todos os livros já possuem metadados ou estão na lixeira.", "info");
      return;
    }

    if (!confirm(`Deseja sincronizar ${booksToEnrich.length} livros usando Inteligência Artificial?`)) {
      return;
    }

    setIsSyncing(true);
    let successCount = 0;

    try {
      for (const book of booksToEnrich) {
        try {
          console.log("Gemini request iniciada");
          // Safety delay of 1 second before each request to stay well below Gemini rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));

          const data = await callGeminiDirectly(book.title, book.author, book.isbn, book.fileName, userApiKey);

          console.log("Gemini response recebida");
          const now = Date.now();
          setBooks(prev => prev.map(b => b.id === book.id ? { ...b, ...data, lastEnriched: now } : b));
          successCount++;
        } catch (err: any) {
          console.error(`Error enriching "${book.title}":`, err);
          showToastMsg(`Erro ao sincronizar "${book.title}": ${err.message}`, "error");
          break; // Stop batch enrichment on first error to prevent endless spam
        }
      }
    } finally {
      setIsSyncing(false);
    }

    if (successCount > 0) {
      showToastMsg(`${successCount} livros foram sincronizados com sucesso.`, "success");
    }
  };

  const testGemini = async () => {
    console.log("TESTE GEMINI INICIADO");
    console.log("API KEY:", !!userApiKey);

    try {
      const response = await fetch("/api/test-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userApiKey: userApiKey || "" })
      });

      console.log("STATUS:", response.status);
      const data = await response.json();
      console.log("RESPOSTA:", data);

      if (response.ok) {
        showToastMsg("Teste do Gemini bem-sucedido! Verifique o console.", "success");
      } else {
        const errorMsg = data.error || (data.error && typeof data.error === 'object' ? JSON.stringify(data.error) : "Erro desconhecido");
        showToastMsg(`Teste Gemini falhou (Status: ${response.status}). ${errorMsg}`, "error");
      }
    } catch (err: any) {
      console.error("ERRO NO TESTE:", err);
      showToastMsg(`Erro ao testar Gemini: ${err.message}`, "error");
    }
  };

  const moveToTrash = (id: string) => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, inTrash: true } : b));
    setSelectedBook(null);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const bulkMoveToTrash = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`Deseja mover ${count} livros para a lixeira?`)) return;
    
    setBooks(prev => prev.map(b => selectedIds.has(b.id) ? { ...b, inTrash: true } : b));
    setSelectedIds(new Set());
    setSelectedBook(null);
  };

  const toggleBookSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const restoreFromTrash = (id: string) => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, inTrash: false } : b));
  };

  const emptyTrash = async () => {
    if (!confirm("Tem certeza que deseja remover permanentemente os itens da lixeira da sua biblioteca? Isso não apagará os arquivos originais.")) return;
    setBooks(prev => prev.filter(b => !b.inTrash));
    if (selectedBook?.inTrash) setSelectedBook(null);
  };

  const removeFolder = (id: string) => {
    if (!confirm("Remover esta pasta das monitoradas? Isso não apagará seus arquivos.")) return;
    setFolderHandles(prev => prev.filter(f => f.id !== id));
  };

  const filteredBooks = books
    .filter(b => {
      // Filter by view mode first
      if (viewMode === "library" && b.inTrash) return false;
      if (viewMode === "trash" && !b.inTrash) return false;

      const q = searchQuery.toLowerCase();
      return (
        b.title.toLowerCase().includes(q) || 
        b.author.toLowerCase().includes(q) ||
        (b.publisher && b.publisher.toLowerCase().includes(q)) ||
        (b.publicationDate && b.publicationDate.toLowerCase().includes(q)) ||
        (b.genre && b.genre.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "date") return (b.importedAt || 0) - (a.importedAt || 0);
      return a.author.localeCompare(b.author);
    });

  return (
    <div className="flex h-[100dvh] w-full bg-bg-main text-gray-200 overflow-hidden font-sans">
      <SidebarLeft 
        folderHandles={folderHandles} 
        onAddFolder={addFolder}
        onAddFiles={addFiles}
        viewMode={viewMode}
        setViewMode={setViewMode}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onRemoveFolder={removeFolder}
        onEmptyTrash={emptyTrash}
        trashCount={books.filter(b => b.inTrash).length}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        userApiKey={userApiKey}
        onUserApiKeyChange={handleUserApiKeyChange}
        onTestGemini={testGemini}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-[#2d221a] flex items-center justify-between px-6 bg-bg-header shrink-0">
          <div className="flex gap-4 items-center flex-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-white/5 rounded-lg text-stone-400 transition-colors"
            >
              <Menu size={20} />
            </button>
            <form 
              onSubmit={(e) => { e.preventDefault(); setSearchQuery(tempSearchQuery); }}
              className="relative w-full max-w-sm flex items-center"
            >
              <button 
                type="submit"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-accent-blue p-1 rounded transition-colors cursor-pointer flex items-center justify-center outline-none"
                title="Pesquisar"
              >
                <Search size={16} />
              </button>
              <input 
                type="text" 
                placeholder="Buscar por título ou autor..." 
                value={tempSearchQuery}
                onChange={(e) => setTempSearchQuery(e.target.value)}
                className="bg-[#1a1410] border-none rounded-lg py-2 pl-10 pr-10 text-xs w-full focus:ring-1 focus:ring-accent-blue text-stone-200 transition-all placeholder-stone-600"
              />
              {tempSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setTempSearchQuery("");
                    setSearchQuery("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-1 rounded transition-colors cursor-pointer"
                  title="Limpar pesquisa"
                >
                  <X size={14} className="text-gray-400" />
                </button>
              )}
            </form>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider hidden md:inline">
              {filteredBooks.length} volumes encontrados
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={refreshLibrary}
              disabled={isScanning}
              className={cn(
                "p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors",
                isScanning && "animate-spin"
              )}
              title="Rescan folders"
            >
              <RefreshCw size={18} />
            </button>
            <button 
              onClick={enrichAllBooks}
              disabled={isEnriching}
              className="p-2 hover:bg-white/5 rounded-lg text-stone-400 hover:text-accent-blue transition-colors"
              title="Sincronizar toda a biblioteca"
            >
              <Search size={18} className={isEnriching ? "animate-pulse" : ""} />
            </button>
            <UploadMenu onAddFolder={addFolder} onAddFiles={addFiles} align="top" />
          </div>
        </header>

        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar relative wood-planks-vertical">
          {/* Real hanging cozy trailing ivy vines descending from top library corners */}
          <CozyHangingIvy className="absolute top-0 left-0 w-28 h-[400px] opacity-25 pointer-events-none z-25" />
          <CozyHangingIvy className="absolute top-24 right-0 w-24 h-[350px] scale-x-[-1] opacity-20 pointer-events-none z-25" />

          {/* Library relies completely on integrated modern wood-shelf spotlight cascades dynamically rendered per BookCard */}

          <AnimatePresence mode="popLayout">
            {filteredBooks.length > 0 ? (
              <motion.div 
                layout
                className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 content-start pb-20 md:pb-8"
              >
                {filteredBooks.map((book: BookMetadata) => (
                  <BookCard 
                    key={book.id} 
                    book={book} 
                    isSelected={selectedBook?.id === book.id}
                    isMultiSelected={selectedIds.has(book.id)}
                    onClick={() => setSelectedBook(prev => prev?.id === book.id ? null : book)} 
                    onSelectToggle={(e) => toggleBookSelection(book.id, e)}
                  />
                ))}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                <BookOpen size={48} className="mb-4" />
                <p className="text-sm font-medium tracking-widest uppercase">Biblioteca Vazia</p>
                <p className="text-xs mt-2">Adicione pastas para ver seus e-books</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <SidebarRight 
        book={selectedBook} 
        onClose={() => setSelectedBook(null)} 
        onEnrich={() => selectedBook && enrichBook(selectedBook.id)}
        isEnriching={isEnriching}
        onMoveToTrash={moveToTrash}
        onRestore={restoreFromTrash}
        showToastMsg={showToastMsg}
      />

      <AnimatePresence>
        {showIframeNotice && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          >
            <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center shadow-2xl">
              <div className="w-16 h-16 bg-accent-blue/10 text-accent-blue rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-accent-blue/10 animate-pulse">
                <Info size={32} />
              </div>
              <h2 className="text-2xl font-bold text-stone-100 mb-4 font-serif">Ação Necessária</h2>
              <p className="text-stone-400 mb-8 text-sm leading-relaxed">
                Para acessar as pastas do seu dispositivo, este aplicativo precisa ser executado em uma aba própria, fora do ambiente de visualização restrito.
              </p>
              <div className="flex flex-col gap-3">
                <a 
                  href={window.location.href} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full bg-accent-blue hover:bg-accent-blue-hover text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-amber-950/50"
                >
                  Abrir em Nova Aba
                </a>
                <button 
                  onClick={() => setShowIframeNotice(false)}
                  className="w-full bg-transparent hover:bg-white/5 text-gray-500 font-bold py-3 rounded-xl transition-all"
                >
                  Continuar mesmo assim
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isScanning && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="bg-accent-blue text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold border border-white/20">
              <RefreshCw className="animate-spin" size={14} />
              <span>Sincronizando arquivos...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[80] bg-[#1d1611] border border-[#3b2d24] px-6 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex items-center gap-8 min-w-[300px]"
          >
            <div className="flex flex-col">
              <span className="text-xl font-bold text-white">{selectedIds.size}</span>
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Selecionados</span>
            </div>
            
            <div className="h-8 w-px bg-amber-950/30" />
            
            <div className="flex items-center gap-3">
              <button 
                onClick={bulkMoveToTrash}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="p-2 bg-red-500/10 group-hover:bg-red-500 text-red-500 group-hover:text-white rounded-lg transition-all">
                  <Trash2 size={20} />
                </div>
                <span className="text-[9px] font-bold text-gray-500 uppercase">Lixeira</span>
              </button>
              
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="p-2 bg-white/5 group-hover:bg-white/10 text-gray-400 group-hover:text-white rounded-lg transition-all">
                  <X size={20} />
                </div>
                <span className="text-[9px] font-bold text-gray-500 uppercase">Cancelar</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={cn(
              "fixed bottom-6 right-6 z-[100] max-w-sm p-4 rounded-xl shadow-2xl flex items-start gap-3 border backdrop-blur-md",
              toast.type === "success" && "bg-emerald-950/90 border-emerald-800/80 text-emerald-200",
              toast.type === "error" && "bg-red-950/90 border-red-800/80 text-red-200",
              toast.type === "info" && "bg-amber-950/90 border-amber-800/80 text-amber-100"
            )}
          >
            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {toast.message}
            </div>
            <button 
              onClick={() => setToast(null)}
              className="text-white/60 hover:text-white transition-colors p-0.5 rounded hover:bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
