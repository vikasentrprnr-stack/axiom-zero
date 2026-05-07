'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { CreateWebWorkerMLCEngine, MLCEngineInterface } from '@mlc-ai/web-llm';
import { 
  Sparkles, Copy, Square, CheckCheck, Menu, X, FileText, Trash2, Plus, 
  ArrowRight, BrainCircuit, ChevronRight, RefreshCw, Pencil, Loader2, 
  Database, Cpu, AlertTriangle, Settings2, ArrowUp, ThumbsUp, 
  ThumbsDown, MonitorSmartphone, ShieldCheck, HelpCircle, 
  MoreVertical, Share2, Download, CheckCircle, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import 'katex/dist/katex.min.css';

import { ApplicationState, TextChunk, ChatMessage } from '@/types/app';
import { cosineSimilarity } from '@/utils/math';
import { saveDocument, getAllSavedDocuments, clearDB, updateDocumentMessages, deleteDocument } from '@/utils/db';
import { DocumentViewerHandle } from '@/components/DocumentView';

const FileDropzone = dynamic(() => import('@/components/FileDropzone'), { ssr: false });
const DocumentView = dynamic(() => import('@/components/DocumentView'), { ssr: false });

type ModelTier = 'mid' | 'high';
type AppFlowState = 'loading' | 'ask_name' | 'rules' | 'selecting' | 'downloading' | 'initializing' | 'ready' | 'active';

interface AIModelConfig { id: string; name: string; desc: string; vram: string; minRam: string; }

const AI_MODELS: Record<ModelTier, AIModelConfig> = {
  'mid': { id: 'gemma-2-2b-it-q4f16_1-MLC', name: 'Gemma 2 (2B)', desc: 'Balanced • High Accuracy', vram: '~1.6GB', minRam: '8GB RAM' },
  'high': { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 (3B)', desc: 'Elite Intelligence • Heavy', vram: '~2.2GB', minRam: '16GB RAM' }
};

const LOADING_FACTS = [
  "Axiom-Zero operates entirely within your local hardware architecture. By leveraging WebGPU, Neural Networks compile and execute directly on your silicon.",
  "Large Language Models predict the next logical token by analyzing billions of mathematical parameters simultaneously.",
  "Web Workers isolate complex tensor operations from the main browser thread, ensuring a flawless 60 FPS interface.",
  "Advanced quantization techniques compress massive neural weights, reducing the memory footprint by up to 400%.",
  "Axiom-Zero maps concepts into a 3D mathematical space to instantly retrieve exact context matches based on conceptual similarity."
];

const smoothEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

const getPhaseTitle = (pct: number) => {
  if (pct < 10) return "Initiating Neural Handshake";
  if (pct < 30) return "Allocating Tensor Cores";
  if (pct < 65) return "Syncing Transformer Weights";
  if (pct < 95) return "Optimizing KV Cache";
  return "Finalizing Architecture";
};

const ProcessingIndicator = ({ status }: { status: string }) => (
  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center space-x-3 text-zinc-300 bg-zinc-800/50 px-4 py-2.5 rounded-full w-fit mb-2 shadow-sm border border-white/10 backdrop-blur-md">
    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
    <span className="text-[13px] font-medium tracking-wide">{status}</span>
  </motion.div>
);

const TypingIndicator = () => (
  <div className="flex space-x-2 items-center h-6 mt-1 px-1">
    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
  </div>
);

const PremiumMarkdownRenderer = ({ content }: { content: string }) => {
  return (
    <div className="text-[15px] leading-relaxed font-open-sans text-zinc-200 w-full min-w-0 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'text';
            const isBlock = !inline && (match || String(children).includes('\n'));
            const safeCodeText = String(children).replace(/\n$/, '').replace(/^(?:undefined\s*\n|undefined)/i, '');
            const [copied, setCopied] = useState(false);
            const handleCopy = () => { navigator.clipboard.writeText(safeCodeText); setCopied(true); setTimeout(() => setCopied(false), 2000); };

            if (isBlock) {
              return (
                <div className="my-5 rounded-xl overflow-hidden border border-white/10 bg-[#0e0e0e] shadow-2xl relative group">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#161616] border-b border-white/5">
                    <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest font-semibold">{language}</span>
                    <button onClick={handleCopy} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-white/10 rounded-md flex items-center space-x-1.5 text-zinc-400 hover:text-white">
                      {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-[10px] font-medium uppercase tracking-wider">{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <SyntaxHighlighter {...props} style={vscDarkPlus} language={language} PreTag="div" customStyle={{ margin: 0, padding: '1.25rem', background: 'transparent', fontSize: '13.5px', lineHeight: '1.6' }}>{safeCodeText}</SyntaxHighlighter>
                </div>
              );
            }
            return (<code {...props} className="bg-zinc-800/80 text-blue-300 px-1.5 py-0.5 rounded-md text-[13.5px] font-mono border border-white/10 break-words">{safeCodeText}</code>);
          },
          p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-5 space-y-2 marker:text-blue-500">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-5 space-y-2 marker:text-blue-500 font-medium"><div className="font-normal text-zinc-200">{children}</div></ol>,
          li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-white font-outfit text-2xl font-semibold mt-8 mb-4 border-b border-white/10 pb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-white font-outfit text-xl font-medium mt-7 mb-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-white font-outfit text-lg font-medium mt-6 mb-2">{children}</h3>,
          strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
          em: ({ children }) => <em className="text-zinc-400 italic">{children}</em>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-500 pl-5 py-2 my-5 bg-gradient-to-r from-blue-500/10 to-transparent rounded-r-lg italic text-zinc-300">{children}</blockquote>,
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

  if (!finalAnswer && thoughtProcess) {
      finalAnswer = `*[Incomplete Generation]*\n\n${thoughtProcess}`;
      thoughtProcess = "";
  }

  return (
    <div className="flex flex-col w-full min-w-0 space-y-3">
      {thoughtProcess && (
        <div className="w-full bg-[#121212] border border-white/5 rounded-xl overflow-hidden mb-2 shadow-sm transition-all hover:border-white/10">
           <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors outline-none">
              <div className="flex items-center space-x-2">
                 <BrainCircuit className="w-4 h-4 text-zinc-400" />
                 <span className="text-xs font-medium text-zinc-400">Internal Logic Evaluated</span>
              </div>
              <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                 <ChevronRight className="w-4 h-4 text-zinc-500" />
              </motion.div>
           </button>
           <AnimatePresence>
             {isOpen && (
               <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/5">
                  <div className="p-4 text-[13px] text-zinc-500 font-mono leading-relaxed whitespace-pre-wrap bg-[#0a0a0a]">{thoughtProcess}</div>
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
  const [appState, setAppState] = useState<AppFlowState>('loading');
  const [userName, setUserName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<any | null>(null);
  const [savedDocs, setSavedDocs] = useState<any[]>([]);
  const [currentDocId, setCurrentDocId] = useState('');
  const [currentDocName, setCurrentDocName] = useState('');
  const [activePdfDocument, setActivePdfDocument] = useState<any>(null); 
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingStatus, setTypingStatus] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, 'like'|'dislike'>>({});
  const [leftWidth, setLeftWidth] = useState(40); 
  const [isVectorizingComplete, setIsVectorizingComplete] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [engineProgressText, setEngineProgressText] = useState('Allocating memory...');
  const [engineProgressPercent, setEngineProgressPercent] = useState(0);
  const [downloadTimeLeft, setDownloadTimeLeft] = useState<string>('Calculating...');
  const [factIndex, setFactIndex] = useState(0);
  const [browserSupported, setBrowserSupported] = useState<boolean | null>(null);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [detectedTier, setDetectedTier] = useState<ModelTier>('mid');
  const [activeModelKey, setActiveModelKey] = useState<ModelTier | null>(null);

  const engineRef = useRef<MLCEngineInterface | null>(null);
  const embedWorker = useRef<Worker | null>(null);
  const documentVectorsRef = useRef<any[]>([]);
  const latestQueryRef = useRef('');
  const downloadStartTimeRef = useRef<number | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pdfViewerRef = useRef<DocumentViewerHandle>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startupLock = useRef(false);
  const initLock = useRef(false);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, streamingContent, isTyping, typingStatus]);

  useEffect(() => {
    if (startupLock.current) return;
    startupLock.current = true;
    const checkEnvironment = async () => {
      const userAgent = typeof window.navigator === "undefined" ? "" : navigator.userAgent;
      const mobile = Boolean(userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i));
      setIsMobile(mobile);
      if (mobile || /^((?!chrome|android).)*safari/i.test(userAgent) || !navigator.gpu) { setBrowserSupported(false); return; }
      setBrowserSupported(true);

      let tier: ModelTier = 'mid'; 
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (adapter && ((navigator as any).deviceMemory > 8 || adapter.limits.maxBufferSize >= 2147483648)) { tier = 'high'; }
      } catch (e) {}
      setDetectedTier(tier);

      const savedName = localStorage.getItem('axiom_user_name');
      const savedModel = localStorage.getItem('axiom_selected_model') as ModelTier;
      const lastDocId = localStorage.getItem('axiom_current_doc_id');

      if (!savedName) { setAppState('ask_name'); return; }
      setUserName(savedName);
      if (!savedModel || !AI_MODELS[savedModel]) { setAppState('selecting'); return; }

      setActiveModelKey(savedModel);
      initWebLLM(savedModel, true);

      const docs = await getAllSavedDocuments();
      setSavedDocs(docs);

      if (lastDocId) {
         const targetDoc = docs.find(d => d.id === lastDocId);
         if (targetDoc) await handleLoadDocument(targetDoc, savedName);
         else setAppState('ready');
      } else {
         setAppState('ready');
      }
    };
    checkEnvironment();
    const interval = setInterval(() => { setFactIndex(prev => (prev + 1) % LOADING_FACTS.length); }, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentDocId && messages.length > 0 && !isTyping) {
        updateDocumentMessages(currentDocId, messages).then(() => { getAllSavedDocuments().then(setSavedDocs); });
    }
  }, [messages, currentDocId, isTyping]);

  useEffect(() => { if(localStorage.getItem('axiom_sidebar_closed') === 'true') setIsSidebarOpen(false); }, []);
  const toggleSidebar = () => { setIsSidebarOpen(prev => { localStorage.setItem('axiom_sidebar_closed', (!prev).toString()); return !prev; }); };

  const initWebLLM = useCallback(async (modelKey: ModelTier, isSilentLoad = false) => {
    if (initLock.current) return;
    initLock.current = true;
    setActiveModelKey(modelKey);
    if (!isSilentLoad) setAppState('downloading'); 
    setEngineReady(false);
    downloadStartTimeRef.current = Date.now();
    setEngineProgressPercent(0);
    
    try {
      const worker = new Worker(new URL('../lib/llm-worker.ts', import.meta.url), { type: 'module' });
      const newEngine = await CreateWebWorkerMLCEngine(worker, AI_MODELS[modelKey].id, { 
          initProgressCallback: (progress) => {
             const rawPct = Math.round(progress.progress * 100) || 0;
             setEngineProgressPercent(prev => Math.max(prev, rawPct)); 
             let cleanText = progress.text.replace(/\[.*?\]\s*/g, '');
             if (cleanText.length > 50) cleanText = cleanText.substring(0, 50) + '...';
             setEngineProgressText(cleanText);

             if (rawPct > 5 && rawPct < 100 && downloadStartTimeRef.current) {
                 const elapsed = (Date.now() - downloadStartTimeRef.current) / 1000; 
                 const totalEst = elapsed / (rawPct / 100);
                 const remaining = Math.max(0, totalEst - elapsed);
                 if (remaining > 60) setDownloadTimeLeft(`${Math.floor(remaining / 60)}M ${Math.floor(remaining % 60)}S`);
                 else setDownloadTimeLeft(`${Math.floor(remaining)}S`);
             } else if (rawPct === 100) setDownloadTimeLeft('0S');
          }
      }, { context_window_size: 4096 }); 

      engineRef.current = newEngine;
      setEngineReady(true);
      initLock.current = false;

      if (!isSilentLoad) {
         const lastDocId = localStorage.getItem('axiom_current_doc_id');
         if (lastDocId) {
             const docs = await getAllSavedDocuments();
             const targetDoc = docs.find(d => d.id === lastDocId);
             if (targetDoc) { await handleLoadDocument(targetDoc, userName); return; }
         }
         setAppState('ready');
      }
    } catch (err: any) {
      console.error("WebLLM Engine Error:", err);
      initLock.current = false;
      if (err.message?.includes('Cache') || err.name === 'NetworkError') {
          alert(`Storage Collision Detected: A corrupted cache or "zombie" download thread is blocking the save process.\n\nThe system will now wipe the corrupted WebLLM cache. Please click OK, then completely refresh the page.`);
          try { caches.keys().then((cacheNames) => { cacheNames.forEach((name) => { if (name.includes('webllm') || name.includes('tvmjs')) caches.delete(name); }); }); } catch(e) {}
      } else { alert(`Model Initialization Failed: ${err.message}`); }
      setAppState('selecting');
    }
  }, [userName]); 

  useEffect(() => {
    embedWorker.current = new Worker(new URL('../lib/embeddingWorker.ts', import.meta.url), { type: 'module' });
    embedWorker.current.onmessage = async (e: MessageEvent) => {
      const { type, vectors, embedding } = e.data;
      if (type === 'EMBED_PROGRESS') { setAppState('initializing'); setIsVectorizingComplete(false); }
      if (type === 'EMBED_COMPLETE') {
          documentVectorsRef.current = vectors; 
          setIsVectorizingComplete(true);
          setTimeout(() => setAppState('active'), 800); 
      }
      if (type === 'QUERY_EMBEDDED') {
          setTypingStatus('Mapping Semantic Vectors...');
          const currentEngine = engineRef.current;
          if (!currentEngine) return;
          
          const denseResults = documentVectorsRef.current
            .map(doc => ({ ...doc, denseScore: cosineSimilarity(embedding, doc.embedding) }))
            .filter(doc => doc.denseScore > 0.12)
            .sort((a,b) => b.denseScore - a.denseScore)
            .slice(0, 10); 

          const queryTerms = latestQueryRef.current.toLowerCase().split(/\W+/).filter(t => t.length > 3);
          const finalChunks = denseResults.map(doc => {
             const textLower = doc.text.toLowerCase();
             let lexicalScore = 0;
             queryTerms.forEach(term => { if (textLower.match(new RegExp(`\\b${term}\\b`, 'g'))) lexicalScore += 0.05; });
             return { ...doc, finalScore: doc.denseScore + lexicalScore };
          }).sort((a,b) => b.finalScore - a.finalScore).slice(0, 4); 

          let contextText = finalChunks.map((c: any) => c.text.replace(/\s+/g, ' ').trim()).join('\n\n---\n\n');
          if (contextText.length > 3500) { contextText = contextText.substring(0, 3500) + "... [Truncated]"; }

          try {
            abortControllerRef.current = new AbortController();
            setStreamingContent('');
            setTypingStatus('Synthesizing Response...');
            
            const conversationHistory = messagesRef.current.slice(-4).map(m => ({ 
                role: m.role as "user" | "assistant", 
                content: m.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim()
            }));

            const systemPrompt = `You are Axiom-Zero, an elite, comprehensive AI analytical engine. Your primary directive is to provide exhaustively detailed, highly accurate, and beautifully structured responses. Never give brief or truncated answers. Break down complex topics deeply using lists and clear formatting. Use the context provided to ensure absolute accuracy. CRITICAL INSTRUCTION: Answer directly. DO NOT output <think> tags. DO NOT explain your thought process.`;
            const userPrompt = `CONTEXT:\n${contextText}\n\nQUESTION: ${latestQueryRef.current}\n\nANSWER:`;

            const chunksStream = await currentEngine.chat.completions.create({
                messages: [ { role: 'system', content: systemPrompt }, ...conversationHistory, { role: 'user', content: userPrompt } ],
                temperature: 0.4, 
                max_tokens: 2500, 
                stream: true,
            });

            let fullResponse = '';
            for await (const chunk of chunksStream) {
               setTypingStatus(''); 
               if (abortControllerRef.current?.signal.aborted) break;
               fullResponse += chunk.choices[0]?.delta?.content || '';
               setStreamingContent(fullResponse); 
            }
            
            setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'assistant', content: fullResponse, sources: finalChunks } as ChatMessage]);
          } catch (err: any) {
             if (err.name !== 'AbortError') setMessages(prev => [...prev, { id: `err`, role: 'assistant', content: `System Error: ${err.message}` } as ChatMessage]);
          } finally {
             setStreamingContent(''); setTypingStatus(''); setIsTyping(false);
          }
      }
    };
    return () => embedWorker.current?.terminate();
  }, []);

  const handleLoadDocument = async (doc: any, name: string) => {
    documentVectorsRef.current = doc.vectors || []; 
    setCurrentDocName(doc.name); setCurrentDocId(doc.id);
    localStorage.setItem('axiom_current_doc_id', doc.id); 
    
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    try {
        const pdfjsDoc = await pdfjs.getDocument({ data: doc.fileBuffer.slice(0) }).promise;
        setActivePdfDocument(pdfjsDoc); setAppState('active');
        if (doc.messages && doc.messages.length > 0) setMessages(doc.messages);
        else setMessages([{ id: `w-${Date.now()}`, role: 'assistant', content: `Hi **${name}**, how can I help you with **${doc.name}** today?` } as ChatMessage]);
    } catch (e) { alert("Failed to render document from cache."); }
  };

  const handleIngestionComplete = async (chunks: TextChunk[], file: File) => {
    setAppState('initializing'); 
    setIsVectorizingComplete(false);
    
    const safeChunks = chunks.slice(0, 100);
    if (chunks.length > 100) console.warn("PDF too large. Truncating to first 100 chunks for memory safety.");

    const buf = await file.arrayBuffer();
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    
    try {
      const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
      setActivePdfDocument(doc); setCurrentDocName(safeChunks[0].documentName);
      
      const newId = safeChunks[0].documentName+'-'+Date.now();
      setCurrentDocId(newId); localStorage.setItem('axiom_current_doc_id', newId); 
      
      embedWorker.current?.postMessage({ type: 'EMBED_CHUNKS', chunks: safeChunks });
      await saveDocument(newId, safeChunks[0].documentName, safeChunks, [], buf, []); 
      
      setSavedDocs(await getAllSavedDocuments());
      setMessages([{ id: `w-${Date.now()}`, role: 'assistant', content: `Hi **${userName}**, I have vectorized **${safeChunks[0].documentName}**. How can I help?` } as ChatMessage]);
    } catch (e) { alert("PDF Rendering Failed."); setAppState('ready'); }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!searchQuery.trim() || isTyping || !engineReady) return;
    const q = searchQuery; setSearchQuery(''); setIsTyping(true); latestQueryRef.current = q; setTypingStatus('Analyzing query...');
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: q } as ChatMessage]);
    embedWorker.current?.postMessage({ type: 'EMBED_QUERY', text: q });
  };

  const stopGeneration = () => { if (abortControllerRef.current) abortControllerRef.current.abort(); setTypingStatus(''); setIsTyping(false); };
  const copyToClipboard = (text: string, id: string) => { navigator.clipboard.writeText(text.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim()); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };
  
  const clearWorkspace = () => { setAppState('ready'); setMessages([]); setActivePdfDocument(null); setCurrentDocId(''); localStorage.removeItem('axiom_current_doc_id'); };
  const executeFullReset = async () => { await clearDB(); localStorage.clear(); window.location.reload(); };

  const shareDocument = (docId: string) => {
      const docToShare = savedDocs.find(d => d.id === docId);
      if (!docToShare || !docToShare.messages) return;
      const minifiedChat = docToShare.messages.map((m: any) => ({ r: m.role, c: m.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim() }));
      const payload = JSON.stringify({ title: docToShare.name, author: userName, chat: minifiedChat });
      const encodedPayload = btoa(encodeURIComponent(payload));
      navigator.clipboard.writeText(`${window.location.origin}/shared?data=${encodedPayload}`);
      alert("Universal Share Link copied to clipboard!\n\nAnyone with this link can view the chat on any device.");
      setActiveDropdown(null);
  };
  
  const exportDocument = async (doc: any) => {
      if (!doc.messages || doc.messages.length === 0) return alert("No history to download.");
      const html2pdf = (await import('html2pdf.js')).default;
      const cleanFileName = doc.name.replace(/\.[^/.]+$/, "");
      const container = document.createElement('div');
      container.style.cssText = 'padding:50px;font-family:system-ui,sans-serif;color:#111827;background:#fff;';
      let htmlContent = `<div style="border-bottom:2px solid #e5e7eb;padding-bottom:24px;margin-bottom:32px;"><h1 style="font-size:32px;font-weight:700;color:#000;margin:0;">Axiom-Zero Report</h1><p style="color:#4b5563;font-size:16px;margin-top:12px;font-weight:500;">Source Document: ${doc.name}</p><p style="color:#9ca3af;font-size:12px;margin-top:6px;">Generated for <strong>${userName}</strong> on ${new Date().toLocaleDateString()}</p></div>`;
      doc.messages.forEach((m: any) => {
          const isUser = m.role === 'user';
          const cleanContent = m.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim().replace(/\n/g, '<br>');
          htmlContent += `<div style="margin-bottom:28px;padding:24px;border-radius:16px;background-color:${isUser ? '#f9fafb' : '#f0fdf4'};border:1px solid ${isUser ? '#f3f4f6' : '#dcfce7'};page-break-inside:avoid;"><div style="font-weight:600;color:${isUser ? '#374151' : '#166534'};margin-bottom:12px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;">${isUser ? userName : '🧠 Axiom-Zero'}</div><div style="line-height:1.7;font-size:14px;color:#1f2937;">${cleanContent}</div></div>`;
      });
      container.innerHTML = htmlContent;
      html2pdf().set({ margin: 0, filename: `Axiom_Report_${cleanFileName}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } }).from(container).save();
      setActiveDropdown(null);
  };

  const confirmDelete = async () => {
      if (!docToDelete) return;
      setSavedDocs(prev => prev.filter(d => d.id !== docToDelete.id)); 
      if (currentDocId === docToDelete.id) clearWorkspace();
      await deleteDocument(docToDelete.id); setDocToDelete(null); setActiveDropdown(null);
  };

  const handleEdit = (msgId: string) => {
    if (isTyping) return;
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex < 0) return;
    setSearchQuery(messages[msgIndex].content); setMessages(messages.slice(0, msgIndex)); inputRef.current?.focus();
  };

  const handleRetry = (msgId: string) => {
    if (isTyping) return;
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex <= 0) return;
    const userQuery = messages[msgIndex - 1].content;
    setMessages(messages.slice(0, msgIndex)); setIsTyping(true); setTypingStatus('Re-analyzing query...'); latestQueryRef.current = userQuery;
    embedWorker.current?.postMessage({ type: 'EMBED_QUERY', text: userQuery });
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); document.body.style.cursor = 'col-resize';
    let animId: number;
    const handleMouseMove = (ev: MouseEvent) => {
       if (animId) cancelAnimationFrame(animId);
       animId = requestAnimationFrame(() => { setLeftWidth(Math.max(25, Math.min((ev.clientX / window.innerWidth) * 100, 60))); });
    };
    const handleMouseUp = () => { document.body.style.cursor = 'default'; window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp);
  }, []);

  if (appState === 'loading') return <div className="h-screen w-screen bg-[#050505]" />;
  if (isMobile) return (<div className="flex h-screen w-screen bg-[#050505] text-white items-center justify-center p-6 font-sans"><div className="max-w-md text-center"><MonitorSmartphone className="w-16 h-16 text-blue-500 mx-auto opacity-80 mb-6" /><h2 className="text-3xl font-semibold mb-2">Desktop Required</h2><p className="text-zinc-400">Axiom-Zero requires desktop WebGPU memory to function safely.</p></div></div>);
  if (browserSupported === false) return (<div className="flex h-screen w-screen bg-[#050505] text-white items-center justify-center p-6"><div className="bg-[#121212] border border-white/10 p-8 rounded-2xl max-w-lg w-full text-center"><AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" /><h2 className="text-2xl font-semibold mb-3">Unsupported Browser</h2><p className="text-zinc-400">Safari and older browsers are unsupported by WebGPU.</p></div></div>);

  return (
    <div className="flex h-screen w-screen bg-[#050505] text-white font-open-sans overflow-hidden">
      
      <AnimatePresence>
        {appState === 'ask_name' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.4, ease: smoothEase }} className="fixed inset-0 z-[200] flex items-center justify-center bg-black">
             <div className="max-w-md w-full text-center p-6">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, duration: 0.6, ease: smoothEase }}>
                   <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-8 shadow-2xl"><Cpu className="w-8 h-8 text-white" /></div>
                   <h1 className="text-3xl font-semibold tracking-tight mb-3">Welcome to Axiom-Zero</h1>
                   <p className="text-zinc-400 mb-8">How should the neural engine address you?</p>
                   <form onSubmit={(e) => { e.preventDefault(); if(nameInput.trim()){ setUserName(nameInput.trim()); localStorage.setItem('axiom_user_name', nameInput.trim()); setAppState('rules'); }}}>
                      <input type="text" autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="e.g., Vikas" className="w-full bg-[#121212] border border-white/10 rounded-2xl px-6 py-4 text-center text-lg text-white outline-none focus:border-blue-500/50 focus:bg-[#161616] transition-all mb-4" />
                      <button disabled={!nameInput.trim()} type="submit" className="w-full bg-white text-black font-semibold rounded-2xl px-6 py-4 hover:bg-zinc-200 transition-colors disabled:opacity-50">Continue</button>
                   </form>
                </motion.div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {appState === 'rules' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.4, ease: smoothEase }} className="fixed inset-0 z-[190] flex items-center justify-center bg-black">
             <div className="max-w-2xl w-full p-8 bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl">
                <h2 className="text-2xl font-semibold mb-6">Neural Engine Instructions</h2>
                <div className="space-y-4 mb-8">
                   <div className="p-4 rounded-xl bg-white/5 border border-white/5"><h3 className="font-semibold text-emerald-400 mb-2 flex items-center"><CheckCircle className="w-4 h-4 mr-2" /> DO'S</h3><p className="text-sm text-zinc-300">Upload clear, text-selectable PDFs. Ask specific, analytical questions about the document structure. Use the model for high-speed local research.</p></div>
                   <div className="p-4 rounded-xl bg-white/5 border border-white/5"><h3 className="font-semibold text-red-400 mb-2 flex items-center"><AlertTriangle className="w-4 h-4 mr-2" /> DON'TS</h3><p className="text-sm text-zinc-300">Do not expect the model to browse the live internet. Do not upload encrypted or image-only PDFs without OCR. Do not refresh mid-generation.</p></div>
                </div>
                <button onClick={() => setAppState('selecting')} className="w-full bg-blue-600 text-white font-semibold rounded-2xl px-6 py-4 hover:bg-blue-500 transition-colors">Acknowledge & Proceed</button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(appState === 'selecting' || showSettingsModal) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.4, ease: smoothEase }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-2xl p-6">
            <div className="max-w-4xl w-full flex flex-col items-center relative">
              {showSettingsModal && (<button onClick={() => setShowSettingsModal(false)} className="absolute -top-12 right-0 p-2 text-zinc-500 hover:text-white rounded-full hover:bg-white/10 transition-colors"><X className="w-6 h-6" /></button>)}
              <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="text-center mb-12"><h1 className="text-4xl font-semibold tracking-tight mb-4">Neural Architecture</h1><p className="text-zinc-400">Select an engine to power your local workspace.</p></motion.div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {(Object.keys(AI_MODELS) as ModelTier[]).map((key) => {
                  const isCurrent = key === activeModelKey;
                  return (
                    <motion.button key={key} whileHover={isCurrent ? {} : { scale: 1.02 }} whileTap={isCurrent ? {} : { scale: 0.98 }} onClick={() => { if (isCurrent) return; localStorage.setItem('axiom_selected_model', key); setShowSettingsModal(false); initWebLLM(key, false); }} className={`p-8 rounded-3xl border transition-all text-left group relative overflow-hidden ${isCurrent ? 'bg-blue-500/10 border-blue-500 cursor-default' : 'bg-white/5 border-white/10 hover:border-blue-500/50 hover:bg-white/10 cursor-pointer'}`}>
                      <div className="absolute top-0 right-0 p-6 opacity-10 transition-opacity"><Cpu className={`w-12 h-12 ${isCurrent ? 'text-blue-400 opacity-50' : 'text-white group-hover:opacity-100'}`} /></div>
                      <div className="flex items-center justify-between mb-2"><h3 className={`text-2xl font-medium ${isCurrent ? 'text-blue-400' : 'text-white'}`}>{AI_MODELS[key].name}</h3>{isCurrent && (<span className="flex items-center px-3 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] uppercase tracking-widest font-bold rounded-full"><CheckCircle className="w-3 h-3 mr-1.5" /> Current</span>)}</div>
                      <p className="text-zinc-400 text-sm mb-6 leading-relaxed">{AI_MODELS[key].desc}</p>
                      <div className="flex gap-4 relative z-10"><span className="flex items-center text-xs font-mono text-zinc-500"><Database className="w-3 h-3 mr-2" />{AI_MODELS[key].vram}</span><span className="flex items-center text-xs font-mono text-zinc-500"><ShieldCheck className="w-3 h-3 mr-2" />{AI_MODELS[key].minRam}</span></div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {appState === 'downloading' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: "blur(10px)", scale: 1.02 }} transition={{ duration: 0.6, ease: smoothEase }} className="fixed inset-0 z-[110] flex items-center justify-center bg-[#030303] font-sans text-white">
            <div className="absolute top-8 right-10 flex items-center space-x-3 text-zinc-500 text-xs tracking-[0.2em] font-medium uppercase"><div className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span></div><span>initializing</span></div>
            <div className="w-full max-w-2xl flex flex-col items-center">
              <h3 className="text-zinc-500 text-sm font-semibold mb-4 tracking-[0.3em] uppercase">Axiom-Zero</h3>
              <div className="h-10 mb-12 relative flex justify-center w-full overflow-hidden"><AnimatePresence mode="wait"><motion.h1 key={getPhaseTitle(engineProgressPercent)} initial={{ opacity: 0, y: 15, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -15, filter: "blur(4px)" }} transition={{ duration: 0.4, ease: "easeOut" }} className="text-white text-3xl font-medium tracking-tight absolute">{getPhaseTitle(engineProgressPercent)}</motion.h1></AnimatePresence></div>
              <div className="w-full max-w-[400px] h-1.5 bg-white/10 rounded-full overflow-hidden mb-8 shadow-[0_0_15px_rgba(255,255,255,0.05)]"><motion.div className="h-full bg-white rounded-full" initial={{ width: 0 }} animate={{ width: `${engineProgressPercent}%` }} transition={{ ease: "linear", duration: 0.2 }} /></div>
              <div className="w-full max-w-[400px] grid grid-cols-2 gap-4">
                 <div className="text-left flex flex-col space-y-1.5"><span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Current Process</span><span className="text-xs font-mono text-zinc-300 truncate transition-opacity duration-300">{engineProgressText || 'Awaiting stream...'}</span><span className="text-xs font-mono text-zinc-400 mt-1"><span className="text-zinc-600">SIZE:</span> {activeModelKey ? AI_MODELS[activeModelKey].vram : '--'}</span></div>
                 <div className="text-right flex flex-col space-y-1.5 items-end"><span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Progress</span><span className="text-xs font-mono text-zinc-300">{engineProgressPercent}%</span><span className="text-xs font-mono text-zinc-400 mt-1"><span className="text-zinc-600">ETA:</span> {downloadTimeLeft}</span></div>
              </div>
              <div className="absolute bottom-16 w-full max-w-xl text-center px-6 h-16 flex items-center justify-center"><AnimatePresence mode="wait"><motion.p key={factIndex} initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 0.6, ease: "easeInOut" }} className="text-[13px] text-zinc-500/80 leading-relaxed font-light">{LOADING_FACTS[factIndex]}</motion.p></AnimatePresence></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
         {docToDelete && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
                 <div className="bg-[#121212] border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                     <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                     <h2 className="text-xl font-semibold mb-2">Delete Workspace?</h2>
                     <p className="text-sm text-zinc-400 mb-8">This will permanently delete the vector embeddings and chat history for "{docToDelete.name}". This action cannot be undone.</p>
                     <div className="flex space-x-3"><button onClick={() => setDocToDelete(null)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-semibold transition-colors">Cancel</button><button onClick={confirmDelete} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors">Delete</button></div>
                 </div>
             </motion.div>
         )}
      </AnimatePresence>

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }} className="h-full border-r border-white/5 bg-[#0a0a0a] flex flex-col flex-shrink-0 relative z-40">
            <div className="h-16 flex items-center justify-between px-6 flex-shrink-0 min-w-[280px] border-b border-white/5"><span className="font-outfit text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-500 truncate">{userName ? `${userName}'s Workspace` : 'Workspace'}</span><button onClick={toggleSidebar} className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"><X className="w-4 h-4" /></button></div>
            <div className="p-4 min-w-[280px]"><button onClick={clearWorkspace} className="w-full py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-400 font-medium hover:bg-blue-500/20 transition-colors flex items-center justify-center space-x-2"><Plus className="w-4 h-4" /><span>New Chat</span></button></div>
            <div className="flex-1 overflow-y-auto px-3 space-y-1 scrollbar-hide min-w-[280px] pb-4">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-3 px-3 font-semibold mt-2">Recent Documents</p>
              {savedDocs.length === 0 && <p className="text-xs text-zinc-700 italic px-3">No history.</p>}
              {savedDocs.map(doc => (
                <div key={doc.id} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all relative ${currentDocId === doc.id ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-zinc-400'}`}>
                  <button onClick={() => handleLoadDocument(doc, userName)} className="flex-1 flex items-center space-x-3 overflow-hidden text-left outline-none"><FileText className="w-4 h-4 flex-shrink-0 text-zinc-500" /><span className="text-[13px] truncate font-medium">{doc.name}</span></button>
                  <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === doc.id ? null : doc.id); }} className="p-1.5 text-zinc-500 hover:text-white rounded-md hover:bg-white/10 transition-colors"><MoreVertical className="w-4 h-4" /></button>
                  <AnimatePresence>
                     {activeDropdown === doc.id && (
                        <>
                           <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); }} />
                           <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-2 top-10 bg-[#161616] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden w-40">
                              <button onClick={(e) => { e.stopPropagation(); shareDocument(doc.id); }} className="w-full text-left px-4 py-2.5 text-xs text-zinc-300 hover:bg-white/5 flex items-center"><Share2 className="w-3.5 h-3.5 mr-2" /> Share Link</button>
                              <button onClick={(e) => { e.stopPropagation(); exportDocument(doc); }} className="w-full text-left px-4 py-2.5 text-xs text-zinc-300 hover:bg-white/5 flex items-center"><Download className="w-3.5 h-3.5 mr-2" /> Download Report</button>
                              <div className="h-px bg-white/10 w-full" />
                              <button onClick={(e) => { e.stopPropagation(); setDocToDelete(doc); }} className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/10 flex items-center"><Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Chat</button>
                           </motion.div>
                        </>
                     )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
            <div className="p-4 min-w-[280px] space-y-2 border-t border-white/5 bg-[#0a0a0a]">
              <button onClick={() => window.open('/help', '_blank')} className="w-full flex items-center justify-start space-x-3 text-sm text-zinc-400 hover:text-white px-3 py-2.5 rounded-lg transition-all hover:bg-white/5"><HelpCircle className="w-4 h-4 text-zinc-500" /><span>Help & Documentation</span></button>
              <button onClick={() => setShowSettingsModal(true)} className="w-full flex items-center justify-start space-x-3 text-sm text-zinc-400 hover:text-white px-3 py-2.5 rounded-lg transition-all hover:bg-white/5"><Settings2 className="w-4 h-4 text-zinc-500" /><span>Change Model</span></button>
              <button onClick={executeFullReset} className="w-full flex items-center justify-start space-x-3 text-sm text-red-400/70 hover:text-red-400 px-3 py-2.5 rounded-lg transition-all hover:bg-red-500/10"><Trash2 className="w-4 h-4 text-red-500/70" /><span>Clear Local Cache</span></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#050505] relative">
        <div className="h-16 flex items-center justify-between px-6 bg-[#050505] border-b border-white/5 shrink-0 z-20">
          <div className="flex items-center space-x-4">
            {!isSidebarOpen && <button onClick={toggleSidebar} className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"><Menu className="w-5 h-5" /></button>}
            <span className="font-outfit text-lg font-semibold tracking-wide text-zinc-100">Axiom-Zero</span>
          </div>
          <div className="flex items-center space-x-4">
             <div className="hidden sm:flex items-center space-x-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-md"><Cpu className="w-3.5 h-3.5 text-zinc-400" /><span className="text-xs text-zinc-200 font-medium">{activeModelKey ? AI_MODELS[activeModelKey].name : 'Engine'}</span></div>
             <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-md border transition-colors duration-300 ${!engineReady ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'}`}><div className={`w-1.5 h-1.5 rounded-full ${!engineReady ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} /><span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline whitespace-nowrap">{engineReady ? 'Active' : 'Allocating'}</span></div>
          </div>
        </div>

        {(appState === 'ready' || appState === 'initializing') ? (
           <div className="flex-1 flex flex-col items-center justify-center p-6">
               {appState === 'initializing' ? (
                   <div className="w-full max-w-md flex flex-col items-center">
                       <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-6" />
                       <h3 className="text-white text-xl font-semibold tracking-tight mb-6">Vectorizing Document</h3>
                       <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-2 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                           <motion.div className="h-full bg-blue-500 rounded-full" initial={{ width: "0%" }} animate={{ width: isVectorizingComplete ? "100%" : "95%" }} transition={{ duration: isVectorizingComplete ? 0.2 : 12, ease: "easeOut" }} />
                       </div>
                       <div className="w-full flex justify-between text-[10px] text-zinc-500 uppercase tracking-widest font-bold"><span>Mapping Semantic Vectors</span><span className={isVectorizingComplete ? "text-blue-400" : "animate-pulse"}>{isVectorizingComplete ? "Complete" : "Processing..."}</span></div>
                   </div>
               ) : ( <FileDropzone onChunksIngested={handleIngestionComplete} /> )}
           </div>
        ) : appState === 'active' ? (
           <div className="flex-1 flex flex-row overflow-hidden relative w-full">
              <div className="hidden lg:flex h-full border-r border-white/5 flex-col bg-[#0a0a0a] shrink-0 relative" style={{ width: `${leftWidth}%` }}>
                 <DocumentView ref={pdfViewerRef} pdfDocument={activePdfDocument} documentName={currentDocName} />
                 <div className="absolute top-0 right-[-4px] bottom-0 w-2 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors z-20 flex items-center justify-center group" onMouseDown={handleMouseDown}><div className="w-0.5 h-12 bg-white/10 rounded-full group-hover:bg-white/80 transition-colors" /></div>
              </div>
              <div className="flex-1 flex flex-col h-full min-w-0 bg-[#050505] relative z-10">
                 <div className="flex-1 overflow-y-auto p-6 lg:p-8 scrollbar-hide">
                    <div className="max-w-3xl mx-auto space-y-8">
                        {messages.map((msg) => (
                           <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse max-w-[85%]' : 'w-full min-w-0'}`}>
                                 {msg.role === 'assistant' && (<div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mt-1 flex-shrink-0"><Sparkles className="w-4 h-4 text-blue-400" /></div>)}
                                 {msg.role === 'user' && (<div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center mt-1 flex-shrink-0"><User className="w-4 h-4 text-zinc-400" /></div>)}
                                 <div className="flex flex-col w-full min-w-0 group relative">
                                    {msg.role === 'user' ? (
                                      <>
                                        <div className="px-5 py-3.5 rounded-2xl bg-[#1e1e1e] border border-white/5 text-zinc-100 text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                                        <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity space-x-1"><button onClick={() => copyToClipboard(msg.content, msg.id)} className="p-1.5 rounded hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"><Copy className="w-3.5 h-3.5" /></button><button onClick={() => handleEdit(msg.id)} className="p-1.5 rounded hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"><Pencil className="w-3.5 h-3.5" /></button></div>
                                      </>
                                    ) : (
                                      <>
                                        <PremiumMarkdownRenderer content={msg.content} />
                                        <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                           <button onClick={() => copyToClipboard(msg.content, msg.id)} className="p-1.5 rounded-lg border border-transparent hover:bg-white/5 text-zinc-500 hover:text-white transition-all flex items-center space-x-1.5">{copiedId === msg.id ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
                                           {!isTyping && (<button onClick={() => handleRetry(msg.id)} className="p-1.5 rounded-lg border border-transparent hover:bg-white/5 text-zinc-500 hover:text-white transition-all"><RefreshCw className="w-3.5 h-3.5" /></button>)}
                                           <div className="w-px h-3 bg-white/10 mx-1" />
                                           <button onClick={() => setFeedbackState(p => ({...p, [msg.id]: 'like'}))} className={`p-1.5 rounded-lg border border-transparent transition-all ${feedbackState[msg.id] === 'like' ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 hover:bg-white/5 hover:text-emerald-400'}`}><ThumbsUp className="w-3.5 h-3.5" /></button>
                                           <button onClick={() => setFeedbackState(p => ({...p, [msg.id]: 'dislike'}))} className={`p-1.5 rounded-lg border border-transparent transition-all ${feedbackState[msg.id] === 'dislike' ? 'text-red-400 bg-red-500/10' : 'text-zinc-500 hover:bg-white/5 hover:text-red-400'}`}><ThumbsDown className="w-3.5 h-3.5 mt-1" /></button>
                                        </div>
                                        {msg.sources && msg.sources.length > 0 && (
                                           <details className="mt-4 border-t border-white/5 pt-3">
                                               <summary className="text-xs text-zinc-500 font-medium cursor-pointer hover:text-zinc-300 transition-colors select-none flex items-center"><ArrowRight className="w-3 h-3 mr-1 inline transform transition-transform group-open:rotate-90" /> Data Provenance ({msg.sources.length})</summary>
                                              <div className="mt-3 grid grid-cols-1 gap-3 border-l-2 border-white/10 pl-4 ml-1">
                                                 {msg.sources.map((src, i) => (
                                                    <div key={`source-${i}`} className="flex flex-col space-y-1"><button onClick={() => pdfViewerRef.current?.setPage(src.pageNumber)} className="w-fit text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded uppercase font-semibold hover:bg-white/10 transition-colors border border-white/10">Page {src.pageNumber}</button><p className="text-[13px] text-zinc-500 leading-relaxed line-clamp-2">"{src.text}"</p></div>
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
                           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex w-full justify-start">
                              <div className="flex gap-4 w-full min-w-0">
                                 <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mt-1 flex-shrink-0"><Sparkles className="w-4 h-4 text-blue-400" /></div>
                                 <div className="flex flex-col w-full min-w-0 group relative">
                                    {typingStatus && !streamingContent && <ProcessingIndicator status={typingStatus} />}
                                    {streamingContent && <PremiumMarkdownRenderer content={streamingContent} />}
                                 </div>
                              </div>
                           </motion.div>
                        )}
                        <div ref={messagesEndRef} className="h-6 shrink-0 w-full" />
                    </div>
                 </div>

                 <div className="w-full p-4 lg:p-6 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent flex flex-col items-center shrink-0 z-20 relative">
                    <form onSubmit={handleSearch} className="w-full max-w-3xl relative flex items-center bg-[#161616] border border-white/10 rounded-2xl p-1.5 shadow-2xl focus-within:border-blue-500/40 focus-within:bg-[#1a1a1a] transition-all">
                       <input ref={inputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} disabled={isTyping || !engineReady} placeholder={isTyping ? "Synthesizing response..." : "Ask Axiom-Zero..."} className="flex-1 bg-transparent text-white text-[15px] py-3.5 px-4 outline-none disabled:opacity-50 placeholder:text-zinc-600 font-open-sans" />
                       {isTyping ? (
                           <button type="button" onClick={stopGeneration} className="p-3 mr-1 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20"><Square className="w-4 h-4 fill-current" /></button>
                       ) : (
                           <button type="submit" disabled={!searchQuery.trim() || !engineReady} className="p-3 mr-1 rounded-xl bg-blue-500 text-white hover:bg-blue-400 transition-all disabled:opacity-50 disabled:bg-[#222] disabled:text-zinc-600 shadow-md flex items-center justify-center"><ArrowUp className="w-4 h-4 stroke-[3px]" /></button>
                       )}
                    </form>
                 </div>
              </div>
           </div>
        ) : null}
      </div>
    </div>
  );
}