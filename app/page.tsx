'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { CreateMLCEngine, MLCEngine } from '@mlc-ai/web-llm';
import { Zap, Sparkles, Copy, Square, CheckCheck, Menu, X, FileText, Trash2, Plus, ArrowRight, BrainCircuit, ChevronRight, RefreshCw, Pencil, Loader2, Database, Cpu, CheckCircle2, Download, HelpCircle, AlertTriangle, Settings2, SlidersHorizontal, CheckCircle, ChevronDown, ArrowUp, ThumbsUp, ThumbsDown, Clock, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import 'katex/dist/katex.min.css';

import { ApplicationState, TextChunk, ChatMessage } from '@/types/app';
import { cosineSimilarity } from '@/utils/math';
import { saveDocument, getAllSavedDocuments, clearDB, updateDocumentMessages, deleteDocument, getDocument } from '@/utils/db';
import { DocumentViewerHandle } from '@/components/DocumentView';

const FileDropzone = dynamic(() => import('@/components/FileDropzone'), { ssr: false });
const DocumentView = dynamic(() => import('@/components/DocumentView'), { ssr: false });

type ModelTier = 'low' | 'mid' | 'high';

interface AIModelConfig {
  id: string;
  name: string;
  desc: string;
  vram: string;
  minRam: string;
}

const AI_MODELS: Record<ModelTier, AIModelConfig> = {
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
      id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', 
      name: 'Llama 3.2 (3B)', 
      desc: 'Elite Intelligence • Heavy', 
      vram: '~2.2GB', 
      minRam: '16GB System RAM' 
  }
};

const LOADING_FACTS = [
  "Axiom-Zero runs entirely on your local GPU. Zero data is sent to the cloud.",
  "Large language models predict the next word based on billions of parameters.",
  "WebGPU allows your browser to execute parallel computations at native speeds.",
  "Quantization reduces model size by 4x without significantly dropping intelligence.",
  "Semantic search maps words into 3D mathematical space to find exact context matches."
];

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

            const handleCopy = () => {
              navigator.clipboard.writeText(safeCodeText);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            };

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
                  <SyntaxHighlighter {...props} style={vscDarkPlus} language={language} PreTag="div" customStyle={{ margin: 0, padding: '1.25rem', background: 'transparent', fontSize: '13.5px', lineHeight: '1.6' }}>
                    {safeCodeText}
                  </SyntaxHighlighter>
                </div>
              );
            }
            return (
              <code {...props} className="bg-zinc-800/80 text-blue-300 px-1.5 py-0.5 rounded-md text-[13.5px] font-mono border border-white/10 break-words">
                {safeCodeText}
              </code>
            );
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

  return (
    <div className="flex flex-col w-full min-w-0 space-y-3">
      {thoughtProcess && (
        <div className="w-full bg-[#121212] border border-white/5 rounded-xl overflow-hidden mb-2 shadow-sm transition-all hover:border-white/10">
           <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors outline-none">
              <div className="flex items-center space-x-2">
                 <BrainCircuit className="w-4 h-4 text-zinc-400" />
                 <span className="text-xs font-medium text-zinc-400">Thought Process</span>
              </div>
              <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                 <ChevronRight className="w-4 h-4 text-zinc-500" />
              </motion.div>
           </button>
           <AnimatePresence>
             {isOpen && (
               <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/5">
                  <div className="p-4 text-[13px] text-zinc-500 font-mono leading-relaxed whitespace-pre-wrap bg-[#0a0a0a]">
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
  const [feedbackState, setFeedbackState] = useState<Record<string, 'like'|'dislike'>>({});

  const [leftWidth, setLeftWidth] = useState(40); 

  const [engineReady, setEngineReady] = useState(false);
  const [engineProgressText, setEngineProgressText] = useState('Initializing Engine...');
  const [engineProgressPercent, setEngineProgressPercent] = useState(0);
  const [downloadTimeLeft, setDownloadTimeLeft] = useState<string>('Calculating...');
  
  const [vectorProgress, setVectorProgress] = useState(0);
  const [factIndex, setFactIndex] = useState(0);

  const [browserSupported, setBrowserSupported] = useState<boolean | null>(null);
  const [warningAccepted, setWarningAccepted] = useState<boolean | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [detectedTier, setDetectedTier] = useState<ModelTier>('low');
  const [activeModelKey, setActiveModelKey] = useState<ModelTier>('low');
  const [isTopDropdownOpen, setIsTopDropdownOpen] = useState(false);

  const engineRef = useRef<MLCEngine | null>(null);
  const embedWorker = useRef<Worker | null>(null);
  const documentVectorsRef = useRef<any[]>([]);
  const latestQueryRef = useRef('');
  const downloadStartTimeRef = useRef<number | null>(null);
  
  const messagesRef = useRef<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pdfViewerRef = useRef<DocumentViewerHandle>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, streamingContent, isTyping, typingStatus]);

  // === UI LOAD DOCUMENT (RESTORED) ===
  const handleLoadDocument = useCallback(async (doc: any) => {
    documentVectorsRef.current = doc.vectors || []; 
    setCurrentDocName(doc.name); 
    setCurrentDocId(doc.id);
    localStorage.setItem('axiom_current_doc_id', doc.id); // Save state for refresh
    
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    try {
        const pdfjsDoc = await pdfjs.getDocument({ data: doc.fileBuffer.slice(0) }).promise;
        setActivePdfDocument(pdfjsDoc); 
        setVectorProgress(100); 
        setAppState('active');
        if (doc.messages && doc.messages.length > 0) setMessages(doc.messages);
        else setMessages([{ id: `w-${Date.now()}`, role: 'assistant', content: `Neural handshake complete. I have mapped **${doc.name}** into memory. What would you like to know?` } as ChatMessage]);
    } catch (e) { alert("Failed to render document from cache."); }
  }, []);

  // === APP INITIALIZATION & PERSISTENT ROUTING ===
  useEffect(() => {
    // 1. Fetch DB and Handle Routing
    getAllSavedDocuments().then(docs => {
       setSavedDocs(docs);
       const lastDocId = localStorage.getItem('axiom_current_doc_id');
       if (lastDocId) {
          const targetDoc = docs.find(d => d.id === lastDocId);
          if (targetDoc) handleLoadDocument(targetDoc);
          else localStorage.removeItem('axiom_current_doc_id');
       }
    });

    // 2. Fact Rotator
    let interval: NodeJS.Timeout;
    if (!engineReady && warningAccepted) {
      interval = setInterval(() => setFactIndex(prev => (prev + 1) % LOADING_FACTS.length), 6000);
    }

    // 3. Hardware Checks
    const checkEnvironment = async () => {
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isSafari || !navigator.gpu) {
          setBrowserSupported(false);
          return;
      }
      setBrowserSupported(true);

      let tier: ModelTier = 'low';
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (adapter) {
          const maxBindingSize = adapter.limits.maxStorageBufferBindingSize;
          if (maxBindingSize >= 1073741824) tier = 'high'; 
          else if (maxBindingSize >= 536870912) tier = 'mid'; 
        }
      } catch (e) { console.error(e); }

      setDetectedTier(tier);
      const accepted = localStorage.getItem('axiom_warning_accepted') === 'true';
      const savedModel = localStorage.getItem('axiom_selected_model') as ModelTier;
      setActiveModelKey(AI_MODELS[savedModel] ? savedModel : tier);
      setWarningAccepted(accepted);
    };
    checkEnvironment();
    
    return () => clearInterval(interval);
  }, [handleLoadDocument, engineReady, warningAccepted]);

  useEffect(() => {
    if (appState === 'ready') {
      getAllSavedDocuments().then(setSavedDocs);
    }
  }, [appState]);

  useEffect(() => {
    if (currentDocId && messages.length > 0 && !isTyping) {
        updateDocumentMessages(currentDocId, messages).then(() => {
            getAllSavedDocuments().then(setSavedDocs); // Refresh sidebar ordering
        });
    }
  }, [messages, currentDocId, isTyping]);

  const initWebLLM = useCallback(async (modelKey: ModelTier) => {
    setEngineReady(false);
    downloadStartTimeRef.current = Date.now();
    
    try {
      const newEngine = await CreateMLCEngine(AI_MODELS[modelKey].id, { 
          initProgressCallback: (progress) => {
             const pct = Math.round(progress.progress * 100) || 0;
             setEngineProgressPercent(pct);
             
             let cleanText = progress.text.replace(/\[.*?\]\s*/g, '');
             if (cleanText.length > 50) cleanText = cleanText.substring(0, 50) + '...';
             setEngineProgressText(cleanText);

             if (pct > 5 && pct < 100 && downloadStartTimeRef.current) {
                 const elapsed = (Date.now() - downloadStartTimeRef.current) / 1000; 
                 const totalEst = elapsed / (pct / 100);
                 const remaining = Math.max(0, totalEst - elapsed);
                 if (remaining > 60) setDownloadTimeLeft(`${Math.ceil(remaining / 60)} mins remaining`);
                 else setDownloadTimeLeft(`${Math.ceil(remaining)} secs remaining`);
             } else if (pct === 100) {
                 setDownloadTimeLeft('Finalizing architecture...');
             }
          }
      });
      engineRef.current = newEngine;
      setEngineReady(true);
    } catch (err: any) {
      console.error(err);
      alert(`Model Initialization Failed.\n\nAuto-reverting to the stable fallback engine to prevent crash.`);
      setActiveModelKey('low');
      localStorage.setItem('axiom_selected_model', 'low');
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    if (warningAccepted === true && browserSupported === true && !engineRef.current && !showSettingsModal) {
        initWebLLM(activeModelKey);
    }
  }, [warningAccepted, browserSupported, showSettingsModal, activeModelKey, initWebLLM]);

  // === RAG PIPELINE & WORKER ===
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
            setTimeout(() => setAppState('active'), 500); 
            break;
        case 'QUERY_EMBEDDED':
          setTypingStatus('Mapping Semantic Vectors...');
          const currentEngine = engineRef.current;
          if (!currentEngine) return;
          
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

          let contextText = finalChunks.map((c: any) => {
              let t = c.text.replace(/<[^>]*>/g, ''); 
              return t.replace(/\s+/g, ' ').trim(); 
          }).join('\n\n---\n\n');

          if (contextText.length > 6000) contextText = contextText.substring(0, 6000) + "... [Truncated]"; 

          try {
            abortControllerRef.current = new AbortController();
            setStreamingContent('');
            setStreamingSources(finalChunks);
            setTypingStatus('Synthesizing Response...');
            
            const conversationHistory = messagesRef.current.slice(-4).map(m => ({
                role: m.role as "user" | "assistant",
                content: m.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim()
            }));

            const systemPrompt = `You are Axiom-Zero, a highly intelligent local AI engine.
Your goal is to answer the user's question exhaustively using the provided context.
1. Be highly detailed. Synthesize the facts beautifully.
2. ALWAYS wrap your internal logic in <think>...</think> tags first.
3. If the context does not hold the answer, clearly state it. Do not hallucinate.`;

            const userPrompt = `CONTEXT:\n${contextText}\n\nQUESTION: ${latestQueryRef.current}\n\nTHINK AND ANSWER:`;

            const chunksStream = await currentEngine.chat.completions.create({
                messages: [ { role: 'system', content: systemPrompt }, ...conversationHistory, { role: 'user', content: userPrompt } ],
                temperature: 0.1, top_p: 0.9, max_tokens: 1500, stream: true,
            });

            let fullResponse = '';
            for await (const chunk of chunksStream) {
               setTypingStatus(''); 
               if (abortControllerRef.current?.signal.aborted) break;
               fullResponse += chunk.choices[0]?.delta?.content || '';
               setStreamingContent(fullResponse); 
            }
            
            setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'assistant', content: fullResponse || "I could not generate an answer.", sources: finalChunks } as ChatMessage]);
          } catch (err: any) {
             if (err.name !== 'AbortError') setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'assistant', content: `System Error: ${err.message}`, sources: [] } as ChatMessage]);
          } finally {
             setStreamingContent(''); setStreamingSources([]); setTypingStatus(''); setIsTyping(false);
          }
          break;
      }
    };
    return () => { if (embedWorker.current) embedWorker.current.terminate(); };
  }, []);

  // === UI HANDLERS ===
  const handleIngestionComplete = async (chunks: TextChunk[], file: File) => {
    const buf = await file.arrayBuffer();
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    try {
      const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
      setActivePdfDocument(doc); setCurrentDocName(chunks[0].documentName);
      const newId = chunks[0].documentName+'-'+Date.now();
      setCurrentDocId(newId);
      localStorage.setItem('axiom_current_doc_id', newId); // Save state
      setAppState('initializing'); setVectorProgress(0);
      embedWorker.current?.postMessage({ type: 'EMBED_CHUNKS', chunks });
      await saveDocument(newId, chunks[0].documentName, chunks, [], buf, []); 
      setSavedDocs(await getAllSavedDocuments());
    } catch (e) { alert("PDF Rendering Failed. Please ensure the file is a valid, text-selectable PDF."); }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!searchQuery.trim() || isTyping || !engineReady) return;
    if (appState === 'ready') setAppState('active');
    
    let vectorSearchQuery = searchQuery;
    const lastUserMessage = [...messagesRef.current].reverse().find(m => m.role === 'user');
    if (lastUserMessage && searchQuery.split(' ').length < 8) vectorSearchQuery = `${lastUserMessage.content} ${searchQuery}`; 
    
    const q = searchQuery; setSearchQuery(''); setIsTyping(true); latestQueryRef.current = q; setTypingStatus('Analyzing query...');
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: q } as ChatMessage]);
    embedWorker.current?.postMessage({ type: 'EMBED_QUERY', text: vectorSearchQuery });
  };

  const stopGeneration = () => { if (abortControllerRef.current) abortControllerRef.current.abort(); setTypingStatus(''); setIsTyping(false); };

  const copyToClipboard = (text: string, id: string) => { 
      navigator.clipboard.writeText(text.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim()); 
      setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); 
  };

  // RESTORED HELPERS
  const handleEdit = (msgId: string) => {
    if (isTyping) return;
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex < 0) return;
    setSearchQuery(messages[msgIndex].content);
    setMessages(messages.slice(0, msgIndex)); 
    inputRef.current?.focus();
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

  const deleteChat = async (e: React.MouseEvent, doc: any) => {
    e.stopPropagation();
    try {
        setSavedDocs(prev => prev.filter(d => d.id !== doc.id)); // Instantly hide from UI
        if (currentDocId === doc.id) { clearWorkspace(); }
        await deleteDocument(doc.id); // Permanently delete from DB
    } catch (err) { console.error("Local DB delete error", err); }
  };

  const exportChatMarkdown = (e: React.MouseEvent, doc: any) => {
    e.stopPropagation();
    if (!doc.messages || doc.messages.length === 0) return alert("No chat history to download.");
    
    let content = `# Chat Export: ${doc.name}\n\n`;
    doc.messages.forEach((m: any) => {
       const role = m.role === 'user' ? '👤 **You**' : '🧠 **Axiom-Zero**';
       const cleanContent = m.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim();
       content += `${role}:\n${cleanContent}\n\n---\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${doc.name.replace(/\s+/g, '_')}_Log.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearWorkspace = () => { 
     setAppState('ready'); 
     setMessages([]); 
     setActivePdfDocument(null); 
     setCurrentDocId(''); 
     localStorage.removeItem('axiom_current_doc_id'); // Wipe state so refresh stays on dropzone
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); document.body.style.cursor = 'col-resize';
    let animationFrameId: number;
    const handleMouseMove = (moveEvent: MouseEvent) => {
       if (animationFrameId) cancelAnimationFrame(animationFrameId);
       animationFrameId = requestAnimationFrame(() => {
           let newWidth = (moveEvent.clientX / window.innerWidth) * 100;
           if (newWidth < 25) newWidth = 25; if (newWidth > 60) newWidth = 60;
           setLeftWidth(newWidth);
       });
    };
    const handleMouseUp = () => {
       document.body.style.cursor = 'default';
       if (animationFrameId) cancelAnimationFrame(animationFrameId);
       window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp);
  }, []);

  if (browserSupported === false) {
     return (
        <div className="flex h-screen w-screen bg-[#050505] text-white items-center justify-center p-6">
           <div className="bg-[#121212] border border-white/10 p-8 rounded-2xl shadow-2xl max-w-lg w-full text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-3">Unsupported Browser</h2>
              <p className="text-zinc-400 leading-relaxed mb-6">Axiom-Zero requires the advanced WebGPU API to run Neural Networks locally. <strong>Safari and older browsers are completely unsupported.</strong></p>
              <div className="bg-white/5 rounded-lg p-4 text-sm text-zinc-300 text-left">
                 <p className="font-semibold mb-2">Please switch to one of the following browsers:</p>
                 <ul className="list-disc pl-5 space-y-1"><li>Google Chrome (Latest)</li><li>Microsoft Edge (Latest)</li><li>Brave Browser</li></ul>
              </div>
           </div>
        </div>
     );
  }

  return (
    <div className="flex h-screen w-screen bg-[#050505] text-white font-open-sans overflow-hidden">
      
      {/* PREMIUM APPLE-LIKE WARNING / SETTINGS MODAL */}
      <AnimatePresence>
        {(warningAccepted === false || showSettingsModal) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl p-6">
             <div className="bg-[#0e0e0e] border border-white/10 p-8 rounded-2xl shadow-2xl max-w-2xl w-full relative">
                
                {showSettingsModal && (
                   <button onClick={() => setShowSettingsModal(false)} className="absolute top-5 right-5 p-2 text-zinc-500 hover:text-white rounded-full hover:bg-white/10 transition-colors">
                      <X className="w-5 h-5" />
                   </button>
                )}

                <div className="mb-8">
                   <h2 className="font-outfit text-2xl font-semibold text-white tracking-tight mb-2">Neural Engine Configuration</h2>
                   <p className="text-sm text-zinc-400">Axiom-Zero downloads AI models directly into your browser's secure cache. Larger models are vastly more intelligent but require powerful hardware.</p>
                </div>
                
                <div className="space-y-6">
                   <div className="flex justify-between items-end border-b border-white/5 pb-4">
                      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Available Architectures</div>
                      <div className="flex items-center space-x-2">
                         <span className="text-xs font-medium text-zinc-500">Hardware Tier:</span>
                         <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-white/5 border border-white/10 ${detectedTier === 'high' ? 'text-blue-400' : 'text-zinc-300'}`}>{detectedTier === 'high' ? 'High-End' : 'Standard'}</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {(Object.keys(AI_MODELS) as Array<ModelTier>).map((key) => {
                         const model = AI_MODELS[key];
                         const isSelected = activeModelKey === key;
                         return (
                            <div 
                               key={key} 
                               onClick={() => setActiveModelKey(key)} 
                               className={`relative flex flex-col p-5 rounded-xl border cursor-pointer transition-all duration-300 ${isSelected ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 'border-white/10 bg-[#121212] hover:bg-[#181818]'}`}
                            >
                               <div className="flex justify-between items-start mb-3">
                                  <h3 className={`font-medium ${isSelected ? 'text-blue-400' : 'text-zinc-200'}`}>{model.name}</h3>
                                  {isSelected ? <CheckCircle className="w-5 h-5 text-blue-500" /> : <div className="w-5 h-5 rounded-full border border-white/20" />}
                               </div>
                               <p className="text-[12px] text-zinc-500 mb-6">{model.desc}</p>
                               <div className="mt-auto space-y-2 pt-4 border-t border-white/5">
                                  <div className="flex items-center text-[11px]"><Database className="w-3 h-3 mr-2 text-zinc-500" /><span className="text-zinc-400">{model.vram} Cache</span></div>
                                  <div className="flex items-center text-[11px]"><Cpu className="w-3 h-3 mr-2 text-zinc-500" /><span className="text-zinc-400">{model.minRam}</span></div>
                               </div>
                            </div>
                         );
                      })}
                   </div>
                   
                   {!showSettingsModal && (
                       <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start space-x-3 mt-4">
                          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                          <p className="text-[13px] text-red-200/80 leading-relaxed">
                            <strong>System Warning:</strong> Executing AI models locally pushes your device to its limits. Running high-tier models on unsupported hardware or battery power may cause browser crashes or severe thermal throttling.
                          </p>
                       </div>
                   )}
                </div>

                <div className="mt-8 flex justify-end pt-4">
                   <button 
                     onClick={() => {
                       localStorage.setItem('axiom_warning_accepted', 'true');
                       if (activeModelKey !== localStorage.getItem('axiom_selected_model')) {
                           setIsTopDropdownOpen(false); 
                           localStorage.setItem('axiom_selected_model', activeModelKey);
                           setEngineReady(false);
                           initWebLLM(activeModelKey);
                       }
                       setShowSettingsModal(false);
                       setWarningAccepted(true);
                     }} 
                     className="px-8 py-3 text-[14px] font-semibold bg-white text-black hover:bg-zinc-200 rounded-lg shadow-xl transition-all"
                   >
                      Confirm & Initialize
                   </button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SIDEBAR */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }} className="h-full border-r border-white/5 bg-[#0a0a0a] flex flex-col flex-shrink-0 relative z-40">
            <div className="h-16 flex items-center justify-between px-6 flex-shrink-0 min-w-[280px] border-b border-white/5">
              <span className="font-outfit text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-500">Workspace</span>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 min-w-[280px]">
               <button onClick={clearWorkspace} className="w-full py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-400 font-medium hover:bg-blue-500/20 transition-colors flex items-center justify-center space-x-2"><Plus className="w-4 h-4" /><span>New Chat</span></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 space-y-1 scrollbar-hide min-w-[280px]">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-3 px-3 font-semibold mt-2">Recent Documents</p>
              {savedDocs.length === 0 && <p className="text-xs text-zinc-700 italic px-3">No history.</p>}
              
              {savedDocs.map(doc => (
                <div key={doc.id} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all group cursor-pointer ${currentDocId === doc.id ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-zinc-400'}`}>
                  <button onClick={() => handleLoadDocument(doc)} className="flex-1 flex items-center space-x-3 overflow-hidden text-left outline-none">
                    <FileText className="w-4 h-4 flex-shrink-0 text-zinc-500" />
                    <span className="text-[13px] truncate font-medium">{doc.name}</span>
                  </button>
                  <div className="hidden group-hover:flex items-center space-x-1 pl-2">
                     <button onClick={(e) => exportChatMarkdown(e, doc)} className="p-1 text-zinc-400 hover:text-blue-400 transition-colors rounded hover:bg-white/10" title="Export as Markdown"><Download className="w-3.5 h-3.5" /></button>
                     <button onClick={(e) => deleteChat(e, doc)} className="p-1 text-zinc-400 hover:text-red-400 transition-colors rounded hover:bg-red-500/10" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 min-w-[280px] space-y-2 border-t border-white/5">
              <button onClick={() => setShowSettingsModal(true)} className="w-full flex items-center justify-start space-x-3 text-sm text-zinc-400 hover:text-white px-3 py-2.5 rounded-lg transition-all hover:bg-white/5">
                <Settings2 className="w-4 h-4 text-zinc-500" /><span>Engine Settings</span>
              </button>
              <button onClick={async () => { await clearDB(); setSavedDocs([]); clearWorkspace(); }} className="w-full flex items-center justify-start space-x-3 text-sm text-red-400/70 hover:text-red-400 px-3 py-2.5 rounded-lg transition-all hover:bg-red-500/10">
                <Trash2 className="w-4 h-4 text-red-500/70" /><span>Clear Local Cache</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#050505] relative">
        {/* HEADER */}
        <div className="h-16 flex items-center justify-between px-6 bg-[#050505] border-b border-white/5 shrink-0 z-20">
          <div className="flex items-center space-x-4">
            {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"><Menu className="w-5 h-5" /></button>}
            <span className="font-outfit text-lg font-semibold tracking-wide text-zinc-100">Axiom-Zero</span>
          </div>
          
          <div className="flex items-center space-x-4">
             <div className="hidden sm:flex relative">
                <button 
                   disabled={!engineReady && appState !== 'initializing'} 
                   onClick={() => setIsTopDropdownOpen(!isTopDropdownOpen)}
                   className="flex items-center space-x-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                   <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                   <span className="text-xs text-zinc-200 font-medium">{AI_MODELS[activeModelKey]?.name || 'Engine'}</span>
                   <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isTopDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                   {isTopDropdownOpen && (
                      <>
                         <div className="fixed inset-0 z-40" onClick={() => setIsTopDropdownOpen(false)} />
                         <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute top-full mt-2 right-0 w-56 bg-[#121212] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                            {(Object.keys(AI_MODELS) as Array<ModelTier>).map((key) => (
                               <button key={key} onClick={() => { setIsTopDropdownOpen(false); if (key !== activeModelKey) { setActiveModelKey(key); localStorage.setItem('axiom_selected_model', key); initWebLLM(key); } }} className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-white/5 last:border-0 hover:bg-white/5`}>
                                  <div className="flex items-center justify-between"><span className={`font-medium ${activeModelKey === key ? 'text-blue-400' : 'text-zinc-300'}`}>{AI_MODELS[key].name}</span>{activeModelKey === key && <CheckCircle2 className="w-4 h-4 text-blue-500" />}</div>
                               </button>
                            ))}
                         </motion.div>
                      </>
                   )}
                </AnimatePresence>
             </div>

             <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-md border transition-colors duration-300 ${!engineReady ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${!engineReady ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline whitespace-nowrap">
                   {engineReady ? 'Active' : 'Occupying System'}
                </span>
             </div>
          </div>
        </div>

        {appState === 'ready' ? (
           <div className="flex-1 flex items-center justify-center p-6"><FileDropzone onChunksIngested={handleIngestionComplete} /></div>
        ) : (
           <div className="flex-1 flex flex-row overflow-hidden relative w-full">
              
              <div className="hidden lg:flex h-full border-r border-white/5 flex-col bg-[#0a0a0a] shrink-0 relative" style={{ width: `${leftWidth}%` }}>
                 <DocumentView ref={pdfViewerRef} pdfDocument={activePdfDocument} documentName={currentDocName} />
                 <div className="absolute top-0 right-[-4px] bottom-0 w-2 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors z-20 flex items-center justify-center group" onMouseDown={handleMouseDown}>
                    <div className="w-0.5 h-12 bg-white/10 rounded-full group-hover:bg-white/80 transition-colors" />
                 </div>
              </div>
              
              <div className="flex-1 flex flex-col h-full min-w-0 bg-[#050505] relative z-10">
                 <div className="flex-1 overflow-y-auto p-6 lg:p-8 scrollbar-hide">
                    <div className="max-w-3xl mx-auto space-y-8">
                        
                        {messages.map((msg) => (
                           <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse max-w-[85%]' : 'w-full min-w-0'}`}>
                                 
                                 {msg.role === 'assistant' && (
                                   <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mt-1 flex-shrink-0">
                                      <Sparkles className="w-4 h-4 text-blue-400" />
                                   </div>
                                 )}

                                 <div className="flex flex-col w-full min-w-0 group relative">
                                    
                                    {msg.role === 'user' ? (
                                      <>
                                        <div className="px-5 py-3.5 rounded-2xl bg-[#1e1e1e] border border-white/5 text-zinc-100 text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                                        <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
                                           <button onClick={() => copyToClipboard(msg.content, msg.id)} className="p-1.5 rounded hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                                           <button onClick={() => handleEdit(msg.id)} className="p-1.5 rounded hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <MessageWithThinking content={msg.content} />
                                        
                                        <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                           <button onClick={() => copyToClipboard(msg.content, msg.id)} className="p-1.5 rounded-lg border border-transparent hover:bg-white/5 text-zinc-500 hover:text-white transition-all flex items-center space-x-1.5">
                                              {copiedId === msg.id ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                           </button>
                                           {!isTyping && (
                                              <button onClick={() => handleRetry(msg.id)} className="p-1.5 rounded-lg border border-transparent hover:bg-white/5 text-zinc-500 hover:text-white transition-all"><RefreshCw className="w-3.5 h-3.5" /></button>
                                           )}
                                           <div className="w-px h-3 bg-white/10 mx-1" />
                                           <button onClick={() => setFeedbackState(p => ({...p, [msg.id]: 'like'}))} className={`p-1.5 rounded-lg border border-transparent transition-all ${feedbackState[msg.id] === 'like' ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 hover:bg-white/5 hover:text-emerald-400'}`}><ThumbsUp className="w-3.5 h-3.5" /></button>
                                           <button onClick={() => setFeedbackState(p => ({...p, [msg.id]: 'dislike'}))} className={`p-1.5 rounded-lg border border-transparent transition-all ${feedbackState[msg.id] === 'dislike' ? 'text-red-400 bg-red-500/10' : 'text-zinc-500 hover:bg-white/5 hover:text-red-400'}`}><ThumbsDown className="w-3.5 h-3.5 mt-1" /></button>
                                        </div>

                                        {msg.sources && msg.sources.length > 0 && (
                                           <details className="mt-4 border-t border-white/5 pt-3"><summary className="text-xs text-zinc-500 font-medium cursor-pointer hover:text-zinc-300 transition-colors select-none flex items-center"><ArrowRight className="w-3 h-3 mr-1 inline transform transition-transform group-open:rotate-90" /> Data Provenance ({msg.sources.length})</summary>
                                              <div className="mt-3 grid grid-cols-1 gap-3 border-l-2 border-white/10 pl-4 ml-1">
                                                 {msg.sources.map((src, i) => (
                                                    <div key={`source-${i}`} className="flex flex-col space-y-1">
                                                       <button onClick={() => pdfViewerRef.current?.setPage(src.pageNumber)} className="w-fit text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded uppercase font-semibold hover:bg-white/10 transition-colors border border-white/10">Page {src.pageNumber}</button>
                                                       <p className="text-[13px] text-zinc-500 leading-relaxed line-clamp-2">"{src.text}"</p>
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
                           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex w-full justify-start">
                              <div className="flex gap-4 w-full min-w-0">
                                 <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mt-1 flex-shrink-0"><Sparkles className="w-4 h-4 text-blue-400" /></div>
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

                 {/* OVERLAY */}
                 <div className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none z-50">
                    <AnimatePresence>
                      {(!engineReady && warningAccepted && !showSettingsModal) && (
                        <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 15, scale: 0.95 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="bg-[#121212]/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-5 flex flex-col pointer-events-auto min-w-[360px] max-w-[400px]">
                           <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center space-x-2.5">
                                 <Loader2 className="w-4 h-4 animate-spin text-blue-500"/> 
                                 <span className="text-[13px] text-zinc-200 font-semibold tracking-wide">Downloading Model Weights</span>
                              </div>
                              <span className="text-xs font-mono text-blue-400 font-semibold">{engineProgressPercent}%</span>
                           </div>
                           <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden mb-3">
                             <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300 ease-out" style={{ width: `${engineProgressPercent}%` }} />
                           </div>
                           <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium mb-4">
                              <span className="truncate max-w-[200px]">{engineProgressText}</span>
                              <span className="flex items-center"><Clock className="w-3 h-3 mr-1"/>{downloadTimeLeft}</span>
                           </div>
                           <div className="bg-[#0a0a0a] rounded-lg p-3 border border-white/5 flex items-start space-x-2.5">
                              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                              <motion.p key={factIndex} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11.5px] text-zinc-400 leading-relaxed">
                                 {LOADING_FACTS[factIndex]}
                              </motion.p>
                           </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>

                 {/* INPUT */}
                 <div className="w-full p-4 lg:p-6 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent flex flex-col items-center shrink-0 z-20 relative">
                    <form onSubmit={handleSearch} className="w-full max-w-3xl relative flex items-center bg-[#161616] border border-white/10 rounded-2xl p-1.5 shadow-2xl focus-within:border-blue-500/40 focus-within:bg-[#1a1a1a] transition-all">
                       <input ref={inputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} disabled={isTyping || !engineReady || appState === 'initializing'} placeholder={!engineReady ? `Initializing ${AI_MODELS[activeModelKey]?.name || 'Engine'}...` : isTyping ? "Synthesizing response..." : "Ask Axiom-Zero..."} className="flex-1 bg-transparent text-white text-[15px] py-3.5 px-4 outline-none disabled:opacity-50 placeholder:text-zinc-600 font-open-sans" />
                       
                       {isTyping ? (
                           <button type="button" onClick={stopGeneration} className="p-3 mr-1 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20"><Square className="w-4 h-4 fill-current" /></button>
                       ) : (
                           <button type="submit" disabled={!searchQuery.trim() || !engineReady || appState === 'initializing'} className="p-3 mr-1 rounded-xl bg-blue-500 text-white hover:bg-blue-400 transition-all disabled:opacity-50 disabled:bg-[#222] disabled:text-zinc-600 shadow-md flex items-center justify-center">
                              <ArrowUp className="w-4 h-4 stroke-[3px]" />
                           </button>
                       )}
                    </form>
                    <div className="mt-3 text-[10.5px] text-zinc-600 text-center font-medium tracking-wide">Axiom-Zero runs {AI_MODELS[activeModelKey]?.name || 'Models'} locally. Responses are mathematically generated.</div>
                 </div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}