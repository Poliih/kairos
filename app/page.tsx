'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, RefreshCw, X, Loader2, ChevronUp, ChevronDown, MapPin } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

interface Verse {
  id: number;
  testament: string;
  book_name: string;
  chapter: number;
  verse_number: number;
  text: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BIBLE_BOOKS = [
  "Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio", "Josué", "Juízes", "Rute", 
  "1 Samuel", "2 Samuel", "1 Reis", "2 Reis", "1 Crônicas", "2 Crônicas", "Esdras", "Neemias", "Ester", "Jó", 
  "Salmos", "Provérbios", "Eclesiastes", "Cânticos", "Isaías", "Jeremias", "Lamentações", "Ezequiel", 
  "Daniel", "Oséias", "Joel", "Amós", "Obadias", "Jonas", "Miquéias", "Naum", "Habacuque", 
  "Sofonias", "Ageu", "Zacarias", "Malaquias", 
  "Mateus", "Marcos", "Lucas", "João", "Atos dos Apóstolos", "Romanos", "1 Coríntios", "2 Coríntios", 
  "Gálatas", "Efésios", "Filipenses", "Colossenses", "1 Tessalonicenses", "2 Tessalonicenses", 
  "1 Timóteo", "2 Timóteo", "Tito", "Filemom", "Hebreus", "Tiago", "1 Pedro", "2 Pedro", 
  "1 João", "2 João", "3 João", "Judas", "Apocalipse"
];

const formatBookName = (dbName: string) => {
  if (!dbName) return "";
  if (dbName.startsWith("Livro")) {
    const number = parseInt(dbName.replace("Livro ", ""));
    return BIBLE_BOOKS[number - 1] || dbName;
  }
  return dbName;
};

const FETCH_LIMIT = 40; 

export default function BibleApp() {
  const [currentVerse, setCurrentVerse] = useState<Verse | null>(null);
  const [contextVerses, setContextVerses] = useState<Verse[]>([]); 
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  
  const [dynamicHeader, setDynamicHeader] = useState("");
  
  const modalRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const lastActionRef = useRef<'initial' | 'prev' | 'next' | null>(null);
  const prevScrollHeightRef = useRef(0);

  const generateVerse = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_random_verse_new_testament');
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const verse = data[0] as Verse; 
        verse.book_name = formatBookName(verse.book_name);
        setCurrentVerse(verse);
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error("Erro ao buscar versículo:", error);
      alert("Erro ao buscar a palavra. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const openContext = async () => {
    if (!currentVerse) return;
    
    setIsModalOpen(true);
    setContextVerses([]); 
    setDynamicHeader(`${currentVerse.book_name} ${currentVerse.chapter}`);
    
    lastActionRef.current = 'initial';

    try {
      const { data, error } = await supabase
        .from('verses')
        .select('*')
        .gte('id', currentVerse.id - 20)
        .lte('id', currentVerse.id + 20)
        .order('id', { ascending: true });

      if (error) throw error;

      const formattedData = (data as Verse[]).map(v => ({
        ...v,
        book_name: formatBookName(v.book_name)
      }));

      setContextVerses(formattedData);
    } catch (error) {
      console.error("Erro ao buscar contexto:", error);
    }
  };

  const loadMorePrev = async () => {
    if (isFetchingMore || contextVerses.length === 0) return;
    setIsFetchingMore(true);

    if (scrollContainerRef.current) {
      prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
    }
    lastActionRef.current = 'prev';

    const firstId = contextVerses[0].id;

    try {
      const { data, error } = await supabase
        .from('verses')
        .select('*')
        .lt('id', firstId)
        .order('id', { ascending: false }) 
        .limit(FETCH_LIMIT);

      if (error) throw error;

      if (data && data.length > 0) {
        const formattedNew = (data as Verse[]).reverse().map(v => ({
          ...v,
          book_name: formatBookName(v.book_name)
        }));
        setContextVerses(prev => [...formattedNew, ...prev]);
      }
    } catch (err) { console.error(err); } 
    finally { setIsFetchingMore(false); }
  };

  const loadMoreNext = async () => {
    if (isFetchingMore || contextVerses.length === 0) return;
    setIsFetchingMore(true);
    
    lastActionRef.current = 'next';
    const lastId = contextVerses[contextVerses.length - 1].id;

    try {
      const { data, error } = await supabase
        .from('verses')
        .select('*')
        .gt('id', lastId)
        .order('id', { ascending: true })
        .limit(FETCH_LIMIT);

      if (error) throw error;

      if (data && data.length > 0) {
        const formattedNew = (data as Verse[]).map(v => ({
          ...v,
          book_name: formatBookName(v.book_name)
        }));
        setContextVerses(prev => [...prev, ...formattedNew]);
      }
    } catch (err) { console.error(err); } 
    finally { setIsFetchingMore(false); }
  };

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || contextVerses.length === 0) return;

    if (lastActionRef.current === 'initial') {
      const mainElement = document.getElementById('main-verse');
      if (mainElement) {
        mainElement.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
      lastActionRef.current = null;
    } 
    else if (lastActionRef.current === 'prev') {
      const newScrollHeight = container.scrollHeight;
      const diff = newScrollHeight - prevScrollHeightRef.current;
      
      container.scrollTop += diff;
      lastActionRef.current = null;
    }
  }, [contextVerses]); 

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;

    if (scrollTop < 50) loadMorePrev(); 
    if (scrollTop + clientHeight >= scrollHeight - 50) loadMoreNext();

    const verseElements = Array.from(container.querySelectorAll('[data-header-label]'));
    
    for (const el of verseElements) {
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      if (rect.bottom > containerRect.top + 50) {
        const label = el.getAttribute('data-header-label');
        if (label && label !== dynamicHeader) {
          setDynamicHeader(label);
        }
        break; 
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsModalOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [modalRef]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-amber-500 selection:text-black font-sans">
      
      <div className="w-full max-w-2xl text-center space-y-8">
        <header className="mb-12">
          <h1 className="text-5xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-700 drop-shadow-sm">
            Kairós
          </h1>
          <p className="text-slate-400 mt-3 font-light text-lg">Versículo Aleatório da Bíblia</p>
        </header>

        <AnimatePresence mode="wait">
          {currentVerse ? (
            <motion.div
              key={currentVerse.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              whileHover={{ scale: 1.02 }}
              onClick={openContext}
              className="cursor-pointer group relative bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 md:p-12 rounded-3xl shadow-2xl hover:border-amber-500/30 transition-all duration-300"
            >
              <div className="absolute top-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-xs text-amber-500 font-bold uppercase tracking-widest flex items-center gap-1">
                <BookOpen size={14} /> Ler contexto
              </div>
              <blockquote className="text-2xl md:text-3xl font-serif leading-relaxed text-slate-200">
                "{currentVerse.text}"
              </blockquote>
              <div className="mt-8 flex items-center justify-center gap-2 text-amber-500 font-medium tracking-wide">
                <span>{currentVerse.book_name} {currentVerse.chapter}:{currentVerse.verse_number}</span>
              </div>
            </motion.div>
          ) : (
            <div className="p-12 border border-dashed border-slate-800 rounded-3xl text-slate-600 flex flex-col items-center gap-4">
              <BookOpen size={40} className="opacity-20" />
              <p>Toque no botão abaixo para gerar um versículo aleatório</p>
            </div>
          )}
        </AnimatePresence>

        <button
          onClick={generateVerse}
          disabled={isLoading}
          className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-black font-bold text-lg rounded-full transition-all active:scale-95 shadow-[0_0_30px_-10px_rgba(217,119,6,0.6)] hover:shadow-[0_0_40px_-5px_rgba(217,119,6,0.8)]"
        >
          {isLoading ? (
            <Loader2 className="animate-spin" size={24} />
          ) : (
            <RefreshCw className="group-hover:rotate-180 transition-transform duration-700" size={24} />
          )}
          {isLoading ? "Buscando..." : "Gerar Versículo"}
        </button>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8"
          >
            <motion.div
              ref={modalRef}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-3xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >

              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950 z-20 shadow-md transition-all duration-300">
                <div className="flex flex-col">
                  <h3 className="text-xl font-bold text-amber-500 uppercase tracking-tight transition-all duration-300">
                    {dynamicHeader || `${currentVerse?.book_name} ${currentVerse?.chapter}`}
                  </h3>
                  <p className="text-xs text-slate-500 uppercase tracking-widest flex items-center gap-1 font-medium">
                    <MapPin size={10} /> Contexto de Leitura
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="
                  flex-1 overflow-y-auto p-6 space-y-0 relative bg-slate-900
                  [&::-webkit-scrollbar]:w-1.5
                  [&::-webkit-scrollbar-track]:bg-transparent
                  [&::-webkit-scrollbar-thumb]:bg-slate-600/30
                  [&::-webkit-scrollbar-thumb]:rounded-full
                  hover:[&::-webkit-scrollbar-thumb]:bg-slate-600/60
                "
              >
                {isFetchingMore && (
                   <div className="w-full flex justify-center py-4 opacity-50"><Loader2 className="animate-spin text-amber-500" size={20} /></div>
                )}

                {contextVerses.length === 0 ? (
                   <div className="flex justify-center h-full items-center"><Loader2 className="animate-spin text-amber-600" size={40} /></div>
                ) : (
                  contextVerses.map((v, i) => {
                    const isMain = v.id === currentVerse?.id;
                    const prevVerse = contextVerses[i - 1];
                    const showChapterHeader = !prevVerse || prevVerse.chapter !== v.chapter || prevVerse.book_name !== v.book_name;

                    return (
                      <div 
                        key={v.id} 
                        data-header-label={`${v.book_name} ${v.chapter}`}
                      >
                        {showChapterHeader && (
                          <div className="py-8 flex items-center gap-4 px-2 opacity-50">
                             <div className="h-[1px] flex-1 bg-slate-800"></div>
                             <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                               Fim de {prevVerse ? `${prevVerse.book_name} ${prevVerse.chapter}` : "..."}
                             </span>
                             <div className="h-[1px] flex-1 bg-slate-800"></div>
                          </div>
                        )}

                        <div 
                          id={isMain ? "main-verse" : undefined}
                          className={`
                            leading-relaxed transition-all duration-500 relative rounded-lg 
                            ${isMain 
                              ? "text-amber-100 font-serif text-xl bg-gradient-to-r from-amber-900/10 to-transparent p-6 border-l-4 border-amber-500 my-4 scroll-mt-32" 
                              : "text-slate-400 font-light hover:text-slate-300 px-2 py-3 hover:bg-slate-800/20 text-lg"
                            }
                          `}
                        >
                          <span className={`text-xs font-bold mr-3 select-none absolute left-0 top-4 ${isMain ? "hidden" : "text-slate-600 inline-block w-6 text-right"}`}>
                            {v.verse_number}
                          </span>
                          <span className={isMain ? "" : "pl-8 block"}>
                             {isMain && <span className="text-amber-500 text-xs font-bold mr-2 align-top">{v.verse_number}</span>}
                             {v.text}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}

                 {isFetchingMore && (
                   <div className="w-full flex justify-center py-4 opacity-50"><Loader2 className="animate-spin text-amber-500" size={20} /></div>
                )}
              </div>
              
              <div className="bg-slate-950 p-2 text-center text-[10px] text-slate-600 uppercase tracking-widest border-t border-slate-900 flex justify-center gap-4">
                 <span className="flex items-center gap-1"><ChevronUp size={12}/> Role p/ cima</span>
                 <span className="flex items-center gap-1"><ChevronDown size={12}/> Role p/ baixo</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}