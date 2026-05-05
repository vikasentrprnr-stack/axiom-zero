'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { CreateMLCEngine, MLCEngine } from '@mlc-ai/web-llm';
import { Zap, Sparkles, Copy, Square, CheckCheck, Menu, X, FileText, Trash2, Plus, ArrowRight, BrainCircuit, ChevronRight, RefreshCw, Pencil, Loader2, Database, Cpu, CheckCircle2, Share2, Download, HelpCircle, AlertTriangle, Settings2, SlidersHorizontal, CheckCircle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import 'katex/dist/katex.min.css';

import { ApplicationState, TextChunk, ChatMessage } from '@/types/app';
import { cosineSimilarity } from '@/utils/math';
import { saveDocument, getAllSavedDocuments, clearDB, updateDocumentMessages } from '@/utils/db';
import { DocumentViewerHandle } from '@/components/DocumentView';

const FileDropzone = dynamic(() => import('@/components/FileDropzone'), { ssr: false });
const DocumentView = dynamic(() => import('@/components/DocumentView'), { ssr: false });

// === VERIFIED GEMMA & LLAMA ARCHITECTURE ===
const AI_MODELS = {
  'low': { 
      id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', 
      name: 'Llama 3.2 (1B)', 
      desc: 'Maximum Speed • Basic RAG', 
      vram: '~850MB', 
      minRam: '4GB System RAM' 
  },
  'mid': { 
      id: 'gemma-2-2b-it-q4f16_1-MLC', 
      name: 'Gemma 2 (2B)', 
      desc: 'Balanced • High Accuracy', 
      vram: '~1.6GB', 
      minRam: '8GB System RAM' 
  },
  'high': { 
      id: 'gemma-3-4b-it-q4f16_1-MLC', 
      name: 'Gemma 3 (4B)', 
      desc: 'Elite Intelligence • Heavy', 
      vram: '~2.6GB', 
      minRam: '16GB System RAM' 
  }
};

const ProcessingIndicator = ({ status }: { status: string }) => (
  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center space-x-3 text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-full w-fit mb-2 shadow-sm border border-emerald-500/20">
    <Loader2 className="w-4 h-4 animate-spin" />
    <span className="text-[13px] font-semibold tracking-wide uppercase">{status}</span>
  </motion.div>
);

const TypingIndicator = () => (
  <div className="flex space-x-2 items-center h-6 mt-1 px-1">
    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
  </div>
);

// AST RENDERER
const PremiumMarkdownRenderer = ({ content }: { content: string }) => {
  return (
    <div className="text-[15px] leading-relaxed font-open-sans text-neutral-200 w-full min-w-0 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'text';
            const isBlock = !inline && (match || String(children).includes('\n'));
            const safeCodeText = String(children).replace(/\n$/, '').replace(/^(?:undefined\s*\n|undefined)/i, '');

            if (isBlock) {
              return (
                <div className="my-5 rounded-xl overflow-hidden border border-white/10 bg-[#121212] shadow-2xl">
                  <div className="flex items-center px-4 py-2.5 bg-[#1a1a1a] border-b border-white/5">
                    <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest font-semibold">{language}</span>
                  </div>
                  <SyntaxHighlighter {...props} style={vscDarkPlus} language={language} PreTag="div" customStyle={{ margin: 0, padding: '1.25rem', background: 'transparent', fontSize: '13.5px', lineHeight: '1.6' }}>
                    {safeCodeText}
                  </SyntaxHighlighter>
                </div>
              );
            }
            return (
              <code {...props} className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-md text-[13.5px] font-mono border border-emerald-500/20 break-words">
                {safeCodeText}
              </code>
            );
          },
          p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-5 space-y-2 marker:text-emerald-500">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-5 space-y-2 marker:text-emerald-500 font-medium"><div className="font-normal text-neutral-200">{children}</div></ol>,
          li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-white font-outfit text-2xl font-semibold mt-8 mb-4 border-b border-white/10 pb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-white font-outfit text-xl font-medium mt-7 mb-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-white font-outfit text-lg font-medium mt-6 mb-2">{children}</h3>,
          strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
          em: ({ children }) => <em className="text-neutral-400 italic">{children}</em>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-emerald-500 pl-5 py-2 my-5 bg-gradient-to-r from-emerald-500/10 to-transparent rounded-r-lg italic text-neutral-300">{children}</blockquote>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

const MessageWithThinking = ({ content }: { content: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  let thoughtProcess = "";
  let finalAnswer = content;
  
  const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
  if (thinkMatch) {
    thoughtProcess = thinkMatch[1].trim();
    finalAnswer = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();
  }

  return (
    <div className="flex flex-col w-full min-w-0 space-y-3">
      {thoughtProcess && (
        <div className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl overflow-hidden mb-2 shadow-sm">
           <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors outline-none focus:ring-2 focus:ring-emerald-500/50">
              <div className="flex items-center space-x-2">
                 <BrainCircuit className="w-4 h-4 text-emerald-500" />
                 <span className="text-xs font-medium text-neutral-400">AI Reasoning Process</span>
              </div>
              <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                 <ChevronRight className="w-4 h-4 text-neutral-500" />
              </motion.div>
           </button>
           <AnimatePresence>
             {isOpen && (
               <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/5">
                  <div className="p-4 text-[13px] text-neutral-500 font-mono leading-relaxed whitespace-pre-wrap bg-[#141414]">
                     {thoughtProcess}
                  </div>
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      )}
      {finalAnswer ? <PremiumMarkdownRenderer content={finalAnswer} /> : <TypingIndicator />}
    </div>
  );
};

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  const [appState, setAppState] = useState<ApplicationState>('ready');
  
  const [savedDocs, setSavedDocs] = useState<any[]>([]);
  const [currentDocId, setCurrentDocId] = useState('');
  const [currentDocName, setCurrentDocName] = useState('');
  const [activePdfDocument, setActivePdfDocument] = useState<any>(null); 
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [isTyping, setIsTyping] = useState(false);
  const [typingStatus, setTypingStatus] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingSources, setStreamingSources] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [leftWidth, setLeftWidth] = useState(40); 

  const [engineReady, setEngineReady] = useState(false);
  const [engineProgressText, setEngineProgressText] = useState('Initializing Engine...');
  const [engineProgressPercent, setEngineProgressPercent] = useState(0);
  const [vectorProgress, setVectorProgress] = useState(0);

  const [warningAccepted, setWarningAccepted] = useState<boolean | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [detectedTier, setDetectedTier] = useState<'low' | 'mid' | 'high'>('low');
  const [activeModelKey, setActiveModelKey] = useState<'low' | 'mid' | 'high'>('low');
  const [isTopDropdownOpen, setIsTopDropdownOpen] = useState(false);

  const engineRef = useRef<MLCEngine | null>(null);
  const embedWorker = useRef<Worker | null>(null);
  const documentVectorsRef = useRef<any[]>([]);
  const latestQueryRef = useRef('');
  
  const messagesRef = useRef<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pdfViewerRef = useRef<DocumentViewerHandle>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, streamingContent, isTyping, typingStatus]);
  useEffect(() => { getAllSavedDocuments().then(setSavedDocs); }, [appState]);

  useEffect(() => {
    const checkHardware = async () => {
      let tier: 'low' | 'mid' | 'high' = 'low';
      const nav = navigator as any; 
      if (nav.gpu) {
        try {
          const adapter = await nav.gpu.requestAdapter();
          if (adapter) {
            const maxBindingSize = adapter.limits.maxStorageBufferBindingSize;
            if (maxBindingSize >= 1073741824) { tier = 'high'; } 
            else if (maxBindingSize >= 536870912) { tier = 'mid'; } 
          }
        } catch (e) { console.error("WebGPU check failed.", e); }
      }
      setDetectedTier(tier);
      const accepted = localStorage.getItem('axiom_warning_accepted') === 'true';
      const savedModel = localStorage.getItem('axiom_selected_model') as 'low' | 'mid' | 'high';
      const finalModel = AI_MODELS[savedModel] ? savedModel : tier;
      setActiveModelKey(finalModel);
      setWarningAccepted(accepted);
    };
    checkHardware();
  }, []);

  useEffect(() => {
    if (currentDocId && messages.length > 0 && !isTyping) {
        updateDocumentMessages(currentDocId, messages);
    }
  }, [messages, currentDocId, isTyping]);

  // === FIX 1: THE ENGINE INITIALIZER GLITCH PATCH ===
  const initWebLLM = useCallback(async (modelKey: 'low' | 'mid' | 'high') => {
    setEngineReady(false);
    try {
      const newEngine = await CreateMLCEngine(AI_MODELS[modelKey].id, { 
          initProgressCallback: (progress) => {
             setEngineProgressText(progress.text);
             setEngineProgressPercent(Math.round(progress.progress * 100) || 0);
          }
      });
      engineRef.current = newEngine;
      setEngineReady(true);
      // NOTE: We DO NOT force appState to 'active' here anymore. 
      // It stays 'ready' (Dropzone) until a PDF is actually uploaded.
    } catch (err: any) {
      console.error("WebGPU Boot Crash:", err);
      localStorage.removeItem('axiom_selected_model');
      localStorage.removeItem('axiom_warning_accepted');
      setEngineProgressText("Engine Crash. Reseting configuration...");
      alert(`Fatal Error: ${err.message}. \n\nThe system has wiped the corrupted cache. The page will now refresh.`);
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    if (warningAccepted === true && !engineRef.current && !showSettingsModal) {
        initWebLLM(activeModelKey);
    }
  }, [warningAccepted, showSettingsModal, activeModelKey, initWebLLM]);

  useEffect(() => {
    embedWorker.current = new Worker(new URL('../lib/embeddingWorker.ts', import.meta.url), { type: 'module' });
    
    embedWorker.current.onmessage = async (e: MessageEvent) => {
      const { type, vectors, embedding } = e.data;
      
      switch (type) {
        case 'EMBED_PROGRESS': 
            setAppState('initializing'); 
            setVectorProgress(Math.round((e.data.current / e.data.total) * 100)); 
            break;
        case 'EMBED_COMPLETE': 
            setVectorProgress(100); 
            documentVectorsRef.current = vectors; 
            setTimeout(() => setAppState('active'), 500); // Only switch to active when PDF vectors are done
            break;
        case 'QUERY_EMBEDDED':
          setTypingStatus('Executing Hybrid Retrieval...');
          const currentEngine = engineRef.current;
          
          if (!currentEngine) {
              setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'assistant', content: "The AI engine is still booting up. Please wait.", sources: [] } as ChatMessage]);
              setIsTyping(false);
              return;
          }
          
          const denseResults = documentVectorsRef.current
            .map(doc => ({ ...doc, denseScore: cosineSimilarity(embedding, doc.embedding) }))
            .filter(doc => doc.denseScore > 0.12)
            .sort((a,b) => b.denseScore - a.denseScore)
            .slice(0, 15); 

          const queryTerms = latestQueryRef.current.toLowerCase().split(/\W+/).filter(t => t.length > 3);
          const finalChunks = denseResults.map(doc => {
             const textLower = doc.text.toLowerCase();
             let lexicalScore = 0;
             queryTerms.forEach(term => {
                const regex = new RegExp(`\\b${term}\\b`, 'g');
                const matches = textLower.match(regex);
                if (matches) lexicalScore += matches.length * 0.05; 
             });
             return { ...doc, finalScore: doc.denseScore + lexicalScore };
          })
          .sort((a,b) => b.finalScore - a.finalScore)
          .slice(0, 4); 

          // === FIX 2: AGGRESSIVE HTML SANITIZER FOR CHUNKS ===
          let contextText = finalChunks.map((c: any) => {
              let t = c.text;
              t = t.replace(/<[^>]*>/g, ''); // Strip ALL raw HTML tags (like <br>) from the PDF text
              t = t.replace(/\bAnswer:\s*/gi, ''); // Strip literal "Answer:" words that confuse the AI
              return t.replace(/\s+/g, ' ').trim(); 
          }).join('\n\n---\n\n');

          if (contextText.length > 6000) contextText = contextText.substring(0, 6000) + "... [Truncated]"; 

          try {
            abortControllerRef.current = new AbortController();
            setStreamingContent('');
            setStreamingSources(finalChunks);
            setTypingStatus('Synthesizing neural response...');
            
            let hasReceivedToken = false;
            const watchdog = setTimeout(() => {
                if (!hasReceivedToken && abortControllerRef.current) abortControllerRef.current.abort();
            }, 30000); 

            const conversationHistory = messagesRef.current.slice(-4).map(m => ({
                role: m.role as "user" | "assistant",
                content: m.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim()
            }));

            // === FIX 3: BULLETPROOF SYSTEM PROMPT ===
            const systemPrompt = `You are Axiom-Zero, an elite AI research engine. 
Your ONLY goal is to answer the user's question using the provided DOCUMENT CONTEXT.

CRITICAL DIRECTIVES:
1. EXHAUSTIVE SYNTHESIS: Provide deep, highly detailed, and comprehensive answers. Do not give short summaries. Extract every relevant detail from the context.
2. THEORETICAL DEPTH: If asked a definitional question (e.g., "What is X?"), explain what it is, how it works, and provide contextual examples from the document.
3. USE REASONING: Always begin your response by wrapping your internal thought process in <think> ... </think> tags to analyze the facts.
4. FORMATTING RULES: NEVER use raw HTML tags like <br>. NEVER prefix your response with words like "Answer:". Use pure, clean Markdown.`;

            const userPrompt = `DOCUMENT CONTEXT:\n${contextText}\n\nUSER QUESTION: ${latestQueryRef.current}\n\nTHINK AND ANSWER:`;

            const chunksStream = await currentEngine.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...conversationHistory, 
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.1, 
                top_p: 0.9,       
                max_tokens: 1500,
                stream: true,
            });

            let fullResponse = '';
            for await (const chunk of chunksStream) {
               hasReceivedToken = true;
               setTypingStatus(''); 
               if (abortControllerRef.current.signal.aborted) break;
               fullResponse += chunk.choices[0]?.delta?.content || '';
               setStreamingContent(fullResponse); 
            }
            clearTimeout(watchdog);
            
            setMessages(prev => [...prev, { 
                id: `ai-${Date.now()}`, role: 'assistant', content: fullResponse || "I could not generate an answer.", sources: finalChunks 
            } as ChatMessage]);

          } catch (err: any) {
             setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'assistant', content: `System Error: ${err.message}`, sources: [] } as ChatMessage]);
          } finally {
             setStreamingContent(''); setStreamingSources([]); setTypingStatus(''); setIsTyping(false);
          }
          break;
      }
    };

    return () => { if (embedWorker.current) embedWorker.current.terminate(); };
  }, []);

  const handleModelSwap = async (newModelKey: 'low' | 'mid' | 'high') => {
      if (newModelKey === activeModelKey || !engineReady) return;
      setActiveModelKey(newModelKey);
      setIsTopDropdownOpen(false); 
      localStorage.setItem('axiom_selected_model', newModelKey);
      setEngineReady(false);
      setEngineProgressText('Unloading previous model from VRAM...');
      
      if (engineRef.current) {
          try { await engineRef.current.unload(); } catch(e) {}
          engineRef.current = null;
      }
      initWebLLM(newModelKey);
  };

  const handleIngestionComplete = async (chunks: TextChunk[], file: File) => {
    const buf = await file.arrayBuffer();
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    try {
      const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
      setActivePdfDocument(doc); setCurrentDocName(chunks[0].documentName);
      const newId = chunks[0].documentName+'-'+Date.now();
      setCurrentDocId(newId);
      setAppState('initializing'); setVectorProgress(0);
      embedWorker.current?.postMessage({ type: 'EMBED_CHUNKS', chunks });
      await saveDocument(newId, chunks[0].documentName, chunks, [], buf, []); 
      setSavedDocs(await getAllSavedDocuments());
    } catch (e) { alert("PDF Rendering Failed."); }
  };

  const executeSearch = (q: string, overrideVectorSearchText?: string) => {
      if (!q.trim() || isTyping || !engineReady || appState === 'initializing') return;
      setSearchQuery(''); setIsTyping(true); latestQueryRef.current = q;
      setTypingStatus('Analyzing query...');
      setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: q } as ChatMessage]);
      embedWorker.current?.postMessage({ type: 'EMBED_QUERY', text: overrideVectorSearchText || q });
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); 
    let vectorSearchQuery = searchQuery;
    const currentMsgs = messagesRef.current;
    const lastUserMessage = [...currentMsgs].reverse().find(m => m.role === 'user');
    
    if (lastUserMessage && searchQuery.split(' ').length < 8) vectorSearchQuery = `${lastUserMessage.content} ${searchQuery}`; 
    executeSearch(searchQuery, vectorSearchQuery);
  };

  const handleRetry = (msgId: string) => {
    if (isTyping) return;
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex <= 0) return;
    
    const userQuery = messages[msgIndex - 1].content;
    setMessages(messages.slice(0, msgIndex));
    let vectorSearchQuery = userQuery;
    const previousUserMsg = [...messages.slice(0, msgIndex - 1)].reverse().find(m => m.role === 'user');
    if (previousUserMsg && userQuery.split(' ').length < 8) vectorSearchQuery = `${previousUserMsg.content} ${userQuery}`;
    
    setIsTyping(true); setTypingStatus('Re-analyzing query...'); latestQueryRef.current = userQuery;
    embedWorker.current?.postMessage({ type: 'EMBED_QUERY', text: vectorSearchQuery });
  };

  const handleEdit = (msgId: string) => {
    if (isTyping) return;
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex < 0) return;
    setSearchQuery(messages[msgIndex].content);
    setMessages(messages.slice(0, msgIndex)); 
    inputRef.current?.focus();
  };

  const copyToClipboard = (text: string, id: string) => { 
      navigator.clipboard.writeText(text.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim()); 
      setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); 
  };
  
  const stopGeneration = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setTypingStatus(''); setIsTyping(false);
  };

  const deleteChat = async (e: React.MouseEvent, doc: any) => {
    e.stopPropagation();
    try {
        setSavedDocs(prev => prev.filter(d => d.id !== doc.id));
        if (currentDocId === doc.id) clearWorkspace();
        const db = await import('@/utils/db');
        if ((db as any).deleteDocument) await (db as any).deleteDocument(doc.id);
    } catch (err) {}
  };

  const handleLoadDocument = useCallback(async (doc: any) => {
    documentVectorsRef.current = doc.vectors || []; 
    setCurrentDocName(doc.name); setCurrentDocId(doc.id);
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    try {
        const pdfjsDoc = await pdfjs.getDocument({ data: doc.fileBuffer.slice(0) }).promise;
        setActivePdfDocument(pdfjsDoc); setVectorProgress(100); setAppState('active');
        if (doc.messages && doc.messages.length > 0) setMessages(doc.messages);
        else setMessages([{ id: `w-${Date.now()}`, role: 'assistant', content: `Neural handshake complete. I have mapped **${doc.name}** into memory. What would you like to know?` } as ChatMessage]);
    } catch (e) { alert("Failed to load document."); }
  }, []);

  const clearWorkspace = () => { setAppState('ready'); setMessages([]); setActivePdfDocument(null); setCurrentDocId(''); };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    let animationFrameId: number;
    const handleMouseMove = (moveEvent: MouseEvent) => {
       if (animationFrameId) cancelAnimationFrame(animationFrameId);
       animationFrameId = requestAnimationFrame(() => {
           let newWidth = (moveEvent.clientX / window.innerWidth) * 100;
           if (newWidth < 25) newWidth = 25;
           if (newWidth > 60) newWidth = 60;
           setLeftWidth(newWidth);
       });
    };
    const handleMouseUp = () => {
       document.body.style.cursor = 'default';
       if (animationFrameId) cancelAnimationFrame(animationFrameId);
       window.removeEventListener('mousemove', handleMouseMove);
       window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  const getStatusBadge = () => {
    if (!engineReady) return { text: 'Occupying System', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', Icon: Cpu, spin: true };
    if (appState === 'ready') return { text: 'Ready', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', Icon: Database, spin: false };
    if (appState === 'initializing') return { text: 'Initializing', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', Icon: Loader2, spin: true };
    return { text: 'Active', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', Icon: CheckCircle2, spin: false };
  };
  const statusConfig = getStatusBadge();

  return (
    <div className="flex h-screen w-screen bg-[#050505] text-white font-open-sans overflow-hidden">
      
      {/* PREMIUM SETTINGS / HARDWARE MODAL */}
      <AnimatePresence>
        {(warningAccepted === false || showSettingsModal) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
             <div className="bg-[#121212] border border-white/10 p-8 rounded-2xl shadow-2xl max-w-2xl w-full relative">
                
                {showSettingsModal && (
                   <button onClick={() => setShowSettingsModal(false)} className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-full hover:bg-white/10 transition-colors">
                      <X className="w-5 h-5" />
                   </button>
                )}

                <div className="flex items-center space-x-3 mb-6">
                   <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                      <Settings2 className="w-6 h-6 text-emerald-500" />
                   </div>
                   <h2 className="font-outfit text-2xl font-semibold text-white">Neural Engine Architecture</h2>
                </div>
                
                <div className="space-y-5">
                   <div className="flex justify-between items-center border-b border-white/10 pb-4">
                      <div>
                         <p className="text-[14.5px] leading-relaxed text-neutral-300">Select the AI model you want to run locally. Larger models offer significantly higher intelligence but require strict hardware limits.</p>
                      </div>
                      <div className="hidden sm:flex flex-col items-end shrink-0 ml-6">
                         <span className="text-xs font-medium text-neutral-400 mb-1">Detected Hardware Tier:</span>
                         <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-md ${detectedTier === 'high' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : detectedTier === 'mid' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'}`}>Tier {detectedTier === 'high' ? '3 (High-End)' : detectedTier === 'mid' ? '2 (Standard)' : '1 (Low-VRAM)'}</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                      {(Object.keys(AI_MODELS) as Array<'low' | 'mid' | 'high'>).map((key) => {
                         const model = AI_MODELS[key];
                         const isSelected = activeModelKey === key;
                         return (
                            <div 
                               key={key} 
                               onClick={() => setActiveModelKey(key)} 
                               className={`relative flex flex-col p-5 rounded-xl border cursor-pointer transition-all duration-200 group ${isSelected ? 'border-emerald-500 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-white/10 hover:border-white/30 bg-black/40 hover:bg-black/60'}`}
                            >
                               <div className="flex justify-between items-start mb-3">
                                  <h3 className={`font-outfit font-semibold text-lg ${isSelected ? 'text-emerald-400' : 'text-white group-hover:text-neutral-200'}`}>{model.name}</h3>
                                  {isSelected ? (
                                     <CheckCircle className="w-6 h-6 text-white fill-emerald-500" />
                                  ) : (
                                     <div className="w-6 h-6 rounded-full border border-white/20 group-hover:border-white/40 transition-colors" />
                                  )}
                               </div>
                               
                               <p className="text-[13px] text-neutral-400 mb-5">{model.desc}</p>
                               
                               <div className="mt-auto space-y-3 pt-4 border-t border-white/5">
                                  <div className="flex items-center text-xs font-medium">
                                     <Database className="w-3.5 h-3.5 mr-2 text-neutral-500" />
                                     <span className="text-neutral-500">Allocates: </span>
                                     <span className="text-neutral-300 ml-1.5">{model.vram}</span>
                                  </div>
                                  <div className="flex items-center text-xs font-medium">
                                     <Cpu className="w-3.5 h-3.5 mr-2 text-neutral-500" />
                                     <span className="text-neutral-500">Requires: </span>
                                     <span className="text-neutral-300 ml-1.5">{model.minRam}</span>
                                  </div>
                               </div>
                            </div>
                         );
                      })}
                   </div>
                </div>

                <div className="mt-8 flex items-center justify-end border-t border-white/10 pt-6">
                   <button 
                     onClick={() => {
                       localStorage.setItem('axiom_warning_accepted', 'true');
                       if (activeModelKey !== localStorage.getItem('axiom_selected_model')) {
                           handleModelSwap(activeModelKey);
                       }
                       setShowSettingsModal(false);
                       setWarningAccepted(true);
                     }} 
                     className="px-8 py-3 text-sm font-semibold bg-emerald-500 text-black hover:bg-emerald-400 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
                   >
                      Confirm & Boot Engine
                   </button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }} className="h-full border-r border-white/5 bg-[#0a0a0a] flex flex-col flex-shrink-0 relative z-40 shadow-2xl">
            <div className="h-16 flex items-center justify-between px-6 flex-shrink-0 min-w-[280px]">
              <span className="font-outfit text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-500">Workspace</span>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-4 pb-4 min-w-[280px]">
               <button onClick={clearWorkspace} className="w-full py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white font-medium hover:bg-white/10 transition-colors flex items-center justify-center space-x-2"><Plus className="w-4 h-4" /><span>New Workspace</span></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 space-y-1 scrollbar-hide min-w-[280px]">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-3 px-3 font-semibold mt-4">Memory Cache</p>
              {savedDocs.length === 0 && <p className="text-xs text-neutral-600 italic px-3">No documents stored.</p>}
              
              {savedDocs.map(doc => (
                <div key={doc.id} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all group cursor-pointer ${currentDocId === doc.id ? 'bg-white/10 text-white shadow-md' : 'hover:bg-white/5 text-neutral-400'}`}>
                  <button onClick={() => handleLoadDocument(doc)} className="flex-1 flex items-center space-x-3 overflow-hidden text-left outline-none">
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm truncate font-medium">{doc.name}</span>
                  </button>
                  <div className="hidden group-hover:flex items-center space-x-1 pl-2">
                     <button onClick={(e) => deleteChat(e, doc)} className="p-1 text-neutral-400 hover:text-red-400 transition-colors rounded hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 min-w-[280px] space-y-2 border-t border-white/5">
              {/* === HELP & DOCS LINK RESTORED HERE === */}
              <a href="/help" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center space-x-2 text-sm text-neutral-400 hover:text-white py-2.5 rounded-lg transition-all hover:bg-white/5">
                <HelpCircle className="w-4 h-4" />
                <span>Help & Documentation</span>
              </a>
              <button onClick={() => setShowSettingsModal(true)} className="w-full flex items-center justify-center space-x-2 text-sm text-neutral-400 hover:text-emerald-400 py-2.5 rounded-lg transition-all hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20">
                <SlidersHorizontal className="w-4 h-4" />
                <span>Engine Settings</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#050505] relative">
        <div className="h-16 flex items-center justify-between px-6 bg-[#050505] z-30 shrink-0 border-b border-white/5">
          <div className="flex items-center space-x-4">
            {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"><Menu className="w-5 h-5" /></button>}
            <span className="font-outfit text-xl font-medium tracking-wide">Axiom-Zero</span>
          </div>
          
          <div className="flex items-center space-x-4">
             <div className="relative">
                <button 
                   disabled={!engineReady} 
                   onClick={() => setIsTopDropdownOpen(!isTopDropdownOpen)}
                   className="flex items-center space-x-2 bg-neutral-900/40 border border-white/10 px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                   <Settings2 className="w-3.5 h-3.5 text-neutral-400" />
                   <span className="text-xs text-neutral-300 font-medium">{AI_MODELS[activeModelKey]?.name || 'Model'}</span>
                   <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${isTopDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                   {isTopDropdownOpen && (
                      <>
                         <div className="fixed inset-0 z-40" onClick={() => setIsTopDropdownOpen(false)} />
                         <motion.div 
                            initial={{ opacity: 0, y: -5 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute top-full mt-2 right-0 w-56 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden"
                         >
                            {(Object.keys(AI_MODELS) as Array<'low' | 'mid' | 'high'>).map((key) => (
                               <button 
                                  key={key} 
                                  onClick={() => handleModelSwap(key)} 
                                  className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-white/5 last:border-0 ${activeModelKey === key ? 'bg-emerald-500/10 text-emerald-400' : 'text-neutral-300 hover:bg-white/5'}`}
                               >
                                  <div className="flex items-center justify-between">
                                     <span className="font-medium">{AI_MODELS[key].name}</span>
                                     {activeModelKey === key && <CheckCircle2 className="w-4 h-4" />}
                                  </div>
                                  <div className="text-[10px] text-neutral-500 mt-0.5">{AI_MODELS[key].desc}</div>
                               </button>
                            ))}
                         </motion.div>
                      </>
                   )}
                </AnimatePresence>
             </div>

             <motion.div layout className={`flex items-center space-x-2 px-3 py-1.5 rounded-md border ${statusConfig.color}`}>
                <statusConfig.Icon className={`w-3.5 h-3.5 ${statusConfig.spin ? 'animate-spin' : ''}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">{statusConfig.text} {(!engineReady || appState === 'initializing') && `${!engineReady ? engineProgressPercent : vectorProgress}%`}</span>
             </motion.div>
          </div>
        </div>

        {appState === 'ready' ? (
           <div className="flex-1 flex items-center justify-center p-6"><FileDropzone onChunksIngested={handleIngestionComplete} /></div>
        ) : (
           <div className="flex-1 flex flex-row overflow-hidden relative w-full">
              
              <div className="hidden lg:flex h-full border-r border-white/5 flex-col bg-[#050505] shrink-0" style={{ width: `${leftWidth}%` }}>
                 <DocumentView ref={pdfViewerRef} pdfDocument={activePdfDocument} documentName={currentDocName} />
              </div>
              
              <div className="hidden lg:flex w-2 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500 transition-colors shrink-0 z-20 items-center justify-center group" onMouseDown={handleMouseDown}>
                 <div className="w-0.5 h-8 bg-white/10 rounded-full group-hover:bg-white/50 transition-colors" />
              </div>
              
              <div className="flex-1 flex flex-col h-full min-w-0 bg-[#050505] relative z-10">
                 <div className="flex-1 overflow-y-auto p-6 lg:p-8 scrollbar-hide">
                    <div className="max-w-3xl mx-auto space-y-8">
                        
                        {messages.map((msg) => (
                           <motion.div key={msg.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse max-w-[80%]' : 'w-full min-w-0'}`}>
                                 
                                 {msg.role === 'assistant' && (
                                   <div className="w-7 h-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mt-1 flex-shrink-0">
                                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                                   </div>
                                 )}

                                 <div className="flex flex-col w-full min-w-0 group">
                                    
                                    {msg.role === 'user' ? (
                                      <>
                                        <div className="px-5 py-3.5 rounded-2xl bg-[#262626] text-white text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap">{msg.content}</div>
                                        <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                           <button onClick={() => handleEdit(msg.id)} className="p-1.5 rounded-full hover:bg-white/10 text-neutral-500 hover:text-white transition-colors flex items-center space-x-1" title="Edit Prompt"><Pencil className="w-3.5 h-3.5" /></button>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <MessageWithThinking content={msg.content} />
                                        
                                        <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                           <button onClick={() => copyToClipboard(msg.content, msg.id)} className="p-1.5 rounded-lg bg-neutral-900 border border-white/5 text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all flex items-center space-x-1.5" title="Copy Answer">
                                              {copiedId === msg.id ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                           </button>
                                           {!isTyping && (
                                              <button onClick={() => handleRetry(msg.id)} className="p-1.5 rounded-lg bg-neutral-900 border border-white/5 text-neutral-500 hover:text-emerald-400 hover:bg-neutral-800 transition-all flex items-center space-x-1.5" title="Regenerate Response">
                                                 <RefreshCw className="w-3.5 h-3.5" />
                                              </button>
                                           )}
                                        </div>

                                        {msg.sources && msg.sources.length > 0 && (
                                           <details className="mt-4 border-t border-white/5 pt-3"><summary className="text-xs text-neutral-500 font-medium cursor-pointer hover:text-neutral-300 transition-colors select-none flex items-center"><ArrowRight className="w-3 h-3 mr-1 inline transform transition-transform group-open:rotate-90" /> Source Nodes ({msg.sources.length})</summary>
                                              <div className="mt-3 grid grid-cols-1 gap-3 border-l-2 border-white/10 pl-4 ml-1">
                                                 {msg.sources.map((src, i) => (
                                                    <div key={`source-${i}`} className="flex flex-col space-y-1">
                                                       <button onClick={() => pdfViewerRef.current?.setPage(src.pageNumber)} className="w-fit text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded uppercase font-semibold hover:bg-emerald-500/20 transition-colors shadow-sm">Page {src.pageNumber}</button>
                                                       <p className="text-sm text-neutral-400 leading-relaxed line-clamp-3">"{src.text}"</p>
                                                    </div>
                                                 ))}
                                              </div>
                                           </details>
                                        )}
                                      </>
                                    )}
                                 </div>
                              </div>
                           </motion.div>
                        ))}

                        {isTyping && (
                           <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="flex w-full justify-start">
                              <div className="flex gap-4 w-full min-w-0">
                                 <div className="w-7 h-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mt-1 flex-shrink-0"><Sparkles className="w-3.5 h-3.5 text-emerald-500" /></div>
                                 <div className="flex flex-col w-full min-w-0 group relative">
                                    {typingStatus && !streamingContent && <ProcessingIndicator status={typingStatus} />}
                                    {streamingContent && <MessageWithThinking content={streamingContent} />}
                                 </div>
                              </div>
                           </motion.div>
                        )}
                        <div ref={messagesEndRef} className="h-6 shrink-0 w-full" />
                    </div>
                 </div>

                 {/* === FIX 3: DOWNLOAD SPEED EXPLANATION IN OVERLAY === */}
                 <div className="absolute bottom-28 left-0 right-0 flex justify-center pointer-events-none z-50">
                    <AnimatePresence>
                      {(!engineReady && warningAccepted) && (
                        <motion.div initial={{ opacity: 0, y: 15, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="bg-[#1a1a1a] border border-white/10 shadow-2xl rounded-2xl p-4 flex flex-col space-y-3 pointer-events-auto min-w-[300px]">
                           <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-300 font-medium flex items-center tracking-wide"><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-emerald-500"/> {`Downloading ${AI_MODELS[activeModelKey]?.name || 'Engine'}...`}</span>
                              <span className="text-xs font-mono text-emerald-500 font-semibold">{engineProgressPercent}%</span>
                           </div>
                           <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                             <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${engineProgressPercent}%` }} />
                           </div>
                           <p className="text-[10px] text-neutral-500 italic mt-1 text-center">First-time load requires a full network download. Speeds depend entirely on your internet connection (usually 1-4 mins).</p>
                        </motion.div>
                      )}
                      {(engineReady && appState === 'initializing') && (
                        <motion.div initial={{ opacity: 0, y: 15, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="bg-[#1a1a1a] border border-white/10 shadow-2xl rounded-2xl p-4 flex flex-col space-y-3 pointer-events-auto min-w-[260px]">
                           <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-300 font-medium flex items-center tracking-wide"><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-emerald-500"/> Mapping Vectors...</span>
                              <span className="text-xs font-mono text-emerald-500 font-semibold">{vectorProgress}%</span>
                           </div>
                           <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                             <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${vectorProgress}%` }} />
                           </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>

                 <div className="w-full p-6 pt-4 bg-[#050505] border-t border-white/5 flex flex-col items-center shrink-0 z-20 relative">
                    <form onSubmit={handleSearch} className="w-full max-w-3xl relative flex items-center bg-[#1a1a1a] border border-white/10 rounded-xl p-1.5 shadow-xl focus-within:border-emerald-500/50 transition-colors">
                       <input ref={inputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} disabled={isTyping || !engineReady || appState === 'initializing'} placeholder={!engineReady ? `Initializing ${AI_MODELS[activeModelKey]?.name || 'Engine'}...` : isTyping ? "Synthesizing response..." : "Ask Axiom-Zero..."} className="flex-1 bg-transparent text-white text-[15px] py-3.5 px-4 outline-none disabled:opacity-50 placeholder:text-neutral-500 font-open-sans" />
                       
                       {isTyping ? (
                           <button type="button" onClick={stopGeneration} className="p-3 mr-1 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all border border-red-500/20" title="Stop Generation"><Square className="w-4 h-4 fill-current" /></button>
                       ) : (
                           <button type="submit" disabled={!searchQuery.trim() || !engineReady || appState === 'initializing'} className="p-3 mr-1 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-500 shadow-md"><Zap className="w-4 h-4 fill-current" /></button>
                       )}
                    </form>
                    <div className="mt-3 text-[10.5px] text-neutral-600 text-center font-medium tracking-wide">Axiom-Zero runs {AI_MODELS[activeModelKey]?.name || 'Models'} 100% locally. No data leaves your device.</div>
                 </div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}