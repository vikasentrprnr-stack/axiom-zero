'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { CreateMLCEngine, MLCEngine } from '@mlc-ai/web-llm';
import { User, Activity, Zap, Sparkles, Copy, Square, CheckCheck, Menu, X, FileText, Trash2, Plus, ArrowRight, BrainCircuit, ChevronRight, RefreshCw, Pencil, Loader2, Database, Cpu, CheckCircle2, Share2, Download } from 'lucide-react';
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

// === BULLETPROOF AST RENDERER ===
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
                  <SyntaxHighlighter
                    {...props}
                    style={vscDarkPlus}
                    language={language}
                    PreTag="div"
                    customStyle={{ margin: 0, padding: '1.25rem', background: 'transparent', fontSize: '13.5px', lineHeight: '1.6' }}
                  >
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
      
      {finalAnswer ? (
        <PremiumMarkdownRenderer content={finalAnswer} />
      ) : (
        <TypingIndicator />
      )}
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

  const engineRef = useRef<MLCEngine | null>(null);
  const engineLockRef = useRef(false);
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
    if (currentDocId && messages.length > 0 && !isTyping) {
        updateDocumentMessages(currentDocId, messages);
    }
  }, [messages, currentDocId, isTyping]);

  useEffect(() => {
    if (engineLockRef.current) return;
    engineLockRef.current = true;

    const initWebLLM = async () => {
      try {
        const newEngine = await CreateMLCEngine("Llama-3.2-1B-Instruct-q4f16_1-MLC", { 
            initProgressCallback: (progress) => {
               setEngineProgressText(progress.text);
               setEngineProgressPercent(Math.round(progress.progress * 100) || 0);
            }
        });
        engineRef.current = newEngine;
        setEngineReady(true);
      } catch (err) {
        console.error("WebGPU Boot Crash:", err);
        setEngineProgressText("GPU Initialization Failed.");
      }
    };
    initWebLLM();

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
          setTypingStatus('Retrieving context mapping...');
          const currentEngine = engineRef.current;
          
          if (!currentEngine) {
              setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'assistant', content: "The AI engine is still booting up. Please wait.", sources: [] } as ChatMessage]);
              setIsTyping(false);
              return;
          }
          
          // === THE FIX: Increased Chunk Allowance to 5 for better large-document coverage ===
          const chunks = documentVectorsRef.current
            .map(doc => ({ ...doc, score: cosineSimilarity(embedding, doc.embedding) }))
            .filter(doc => doc.score > 0.15) // Slightly lower threshold to capture complex math phrasing
            .sort((a,b) => b.score - a.score)
            .slice(0, 5); 

          let contextText = chunks.map((c: any) => {
              let t = c.text;
              t = t.replace(/(?:[A-Z]+\s*\|\s*)+[A-Z]+/g, ' '); 
              t = t.replace(/(www\.[^\s]+|https?:\/\/[^\s]+)/gi, ''); 
              t = t.replace(/\b\d{10}\b/g, ''); 
              t = t.replace(/©\s*[A-Za-z\s]+/gi, ''); 
              t = t.replace(/Student Notes:/gi, ''); 
              return t.replace(/\s+/g, ' ').trim(); 
          }).join('\n\n---\n\n');
          
          // === THE MASTER FIX: Increased Context Window to 8000 Chars (~1800 tokens) ===
          if (contextText.length > 8000) {
              contextText = contextText.substring(0, 8000) + "... [Truncated]"; 
          }

          try {
            abortControllerRef.current = new AbortController();
            setStreamingContent('');
            setStreamingSources(chunks);
            setTypingStatus('Synthesizing neural response...');
            
            let hasReceivedToken = false;
            const watchdog = setTimeout(() => {
                if (!hasReceivedToken && abortControllerRef.current) abortControllerRef.current.abort();
            }, 30000); 

            const conversationHistory = messagesRef.current.slice(-4).map(m => ({
                role: m.role as "user" | "assistant",
                content: m.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim()
            }));

            // === THE FIX: Simplified, 1B-Friendly Prompt Architecture ===
            const systemPrompt = `You are Axiom-Zero, a highly intelligent AI research engine.
Your sole purpose is to answer the user's query using ONLY the provided DOCUMENT CONTEXT.

CRITICAL INSTRUCTIONS:
1. Provide a direct, detailed answer based on the context. Do not make up information.
2. If the user asks a theoretical question, use standard text, bullet points, and headers.
3. If the user asks a complex physics, math, or coding question, you MUST use <think>...</think> tags to reason step-by-step first, then output the final code/math below it using proper formatting (\`\`\` for code, $$ for math).
4. NEVER append disclaimers, warnings, or notes like "Note: The provided document does not contain..." to the end of your valid responses. Just provide the answer and stop.`;

            const userPrompt = `DOCUMENT CONTEXT:\n${contextText}\n\nCURRENT QUESTION: ${latestQueryRef.current}\n\nANSWER:`;

            const chunksStream = await currentEngine.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...conversationHistory, 
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.2, // Slightly increased to prevent repetitive looping
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
                id: `ai-${Date.now()}`, 
                role: 'assistant', 
                content: fullResponse || "I could not generate an answer. Please rephrase the question.", 
                sources: chunks 
            } as ChatMessage]);

          } catch (err: any) {
             console.error("AI Generation Failed", err);
             setMessages(prev => [...prev, { 
                 id: `ai-${Date.now()}`, 
                 role: 'assistant', 
                 content: err.name === 'AbortError' 
                    ? "System Error: The AI generation was stopped by user or timed out." 
                    : `System Error: ${err.message || 'Engine crash.'}`, 
                 sources: [] 
             } as ChatMessage]);
          } finally {
             setStreamingContent('');
             setStreamingSources([]);
             setTypingStatus('');
             setIsTyping(false);
          }
          break;
      }
    };

    return () => {
        if (embedWorker.current) {
            embedWorker.current.terminate();
        }
    };
  }, []);

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
    
    if (lastUserMessage && searchQuery.split(' ').length < 8) {
        vectorSearchQuery = `${lastUserMessage.content} ${searchQuery}`; 
    }
    executeSearch(searchQuery, vectorSearchQuery);
  };

  const handleRetry = (msgId: string) => {
    if (isTyping) return;
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex <= 0) return;
    
    const userQuery = messages[msgIndex - 1].content;
    const newMessages = messages.slice(0, msgIndex);
    setMessages(newMessages);
    
    let vectorSearchQuery = userQuery;
    const previousUserMsg = [...newMessages.slice(0, -1)].reverse().find(m => m.role === 'user');
    if (previousUserMsg && userQuery.split(' ').length < 8) {
        vectorSearchQuery = `${previousUserMsg.content} ${userQuery}`;
    }
    
    setIsTyping(true);
    setTypingStatus('Re-analyzing query...');
    latestQueryRef.current = userQuery;
    embedWorker.current?.postMessage({ type: 'EMBED_QUERY', text: vectorSearchQuery });
  };

  const handleEdit = (msgId: string) => {
    if (isTyping) return;
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex < 0) return;
    const query = messages[msgIndex].content;
    setMessages(messages.slice(0, msgIndex)); 
    setSearchQuery(query);
    inputRef.current?.focus();
  };

  const copyToClipboard = (text: string, id: string) => { 
      const cleanText = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();
      navigator.clipboard.writeText(cleanText); 
      setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); 
  };
  
  const stopGeneration = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setTypingStatus('');
    setIsTyping(false);
  };

  const exportChat = (e: React.MouseEvent, doc: any) => {
    e.stopPropagation();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(doc.messages || [], null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `${doc.name.replace(/\s+/g, '_')}_chat.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const shareChat = (e: React.MouseEvent, doc: any) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`https://axiom-zero.local/share/${doc.id}`);
    alert(`Secure share link for ${doc.name} copied to clipboard!`);
  };

  const deleteChat = async (e: React.MouseEvent, doc: any) => {
    e.stopPropagation();
    try {
        setSavedDocs(prev => prev.filter(d => d.id !== doc.id));
        if (currentDocId === doc.id) {
            clearWorkspace();
        }
        const db = await import('@/utils/db');
        if ((db as any).deleteDocument) {
            await (db as any).deleteDocument(doc.id);
        }
    } catch (err) {
        console.error("Deletion handled locally.");
    }
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

  const clearWorkspace = () => {
    setAppState('ready'); setMessages([]); setActivePdfDocument(null); setCurrentDocId('');
  };

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
    if (!engineReady) {
      return { text: 'Occupying System', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', Icon: Cpu, spin: true };
    }
    if (appState === 'ready') {
      return { text: 'Ready', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', Icon: Database, spin: false };
    }
    if (appState === 'initializing') {
      return { text: 'Initializing', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', Icon: Loader2, spin: true };
    }
    return { text: 'Active', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', Icon: CheckCircle2, spin: false };
  };
  const statusConfig = getStatusBadge();

  return (
    <div className="flex h-screen w-screen bg-[#050505] text-white font-open-sans overflow-hidden">
      
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }} className="h-full border-r border-white/5 bg-[#0a0a0a] flex flex-col flex-shrink-0 relative z-40 shadow-2xl">
            <div className="h-16 flex items-center justify-between px-6 flex-shrink-0 min-w-[280px]">
              <span className="font-outfit text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-500">Workspace</span>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/5 transition-colors" aria-label="Close Sidebar"><X className="w-5 h-5" /></button>
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
                     <button onClick={(e) => shareChat(e, doc)} className="p-1 text-neutral-400 hover:text-emerald-400 transition-colors rounded hover:bg-white/10" title="Share Link"><Share2 className="w-3.5 h-3.5" /></button>
                     <button onClick={(e) => exportChat(e, doc)} className="p-1 text-neutral-400 hover:text-emerald-400 transition-colors rounded hover:bg-white/10" title="Export Chat"><Download className="w-3.5 h-3.5" /></button>
                     <button onClick={(e) => deleteChat(e, doc)} className="p-1 text-neutral-400 hover:text-red-400 transition-colors rounded hover:bg-red-500/10" title="Delete Document"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 min-w-[280px]">
              <button onClick={async () => { await clearDB(); setSavedDocs([]); clearWorkspace(); }} className="w-full flex items-center justify-center space-x-2 text-sm text-neutral-500 hover:text-red-400 py-3 rounded-lg transition-all"><Trash2 className="w-4 h-4" /><span>Clear Device Cache</span></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#050505] relative">
        <div className="h-16 flex items-center justify-between px-6 bg-[#050505] z-30 shrink-0 border-b border-white/5">
          <div className="flex items-center space-x-4">
            {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors" aria-label="Open Sidebar"><Menu className="w-5 h-5" /></button>}
            <span className="font-outfit text-xl font-medium tracking-wide">Axiom-Zero</span>
          </div>
          
          <div className="flex items-center space-x-3">
             <motion.div layout className={`flex items-center space-x-2 px-3 py-1.5 rounded-md border ${statusConfig.color}`}>
                <statusConfig.Icon className={`w-3.5 h-3.5 ${statusConfig.spin ? 'animate-spin' : ''}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{statusConfig.text} {(!engineReady || appState === 'initializing') && `${!engineReady ? engineProgressPercent : vectorProgress}%`}</span>
             </motion.div>
             <div className="hidden sm:flex items-center space-x-2 bg-neutral-900/40 border border-white/5 px-3 py-1.5 rounded-md">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className="text-xs text-neutral-400 font-medium">Local Engine</span>
             </div>
          </div>
        </div>

        {appState === 'ready' ? (
           <div className="flex-1 flex items-center justify-center p-6"><FileDropzone onChunksIngested={handleIngestionComplete} /></div>
        ) : (
           <div className="flex-1 flex flex-row overflow-hidden relative w-full">
              
              <div 
                  className="hidden lg:flex h-full border-r border-white/5 flex-col bg-[#050505] shrink-0" 
                  style={{ width: `${leftWidth}%` }}
              >
                 <DocumentView ref={pdfViewerRef} pdfDocument={activePdfDocument} documentName={currentDocName} />
              </div>
              
              <div 
                 className="hidden lg:flex w-2 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500 transition-colors shrink-0 z-20 items-center justify-center group"
                 onMouseDown={handleMouseDown}
              >
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
                                           <details className="mt-4 border-t border-white/5 pt-3"><summary className="text-xs text-neutral-500 font-medium cursor-pointer hover:text-neutral-300 transition-colors select-none flex items-center"><ArrowRight className="w-3 h-3 mr-1 inline transform transition-transform group-open:rotate-90" /> Verified Nodes ({msg.sources.length})</summary>
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
                                    
                                    {typingStatus && !streamingContent && (
                                        <ProcessingIndicator status={typingStatus} />
                                    )}

                                    {streamingContent && (
                                        <MessageWithThinking content={streamingContent} />
                                    )}
                                    
                                    {streamingSources.length > 0 && streamingContent && (
                                       <details className="mt-4 border-t border-white/5 pt-3"><summary className="text-xs text-neutral-500 font-medium cursor-pointer hover:text-neutral-300 transition-colors select-none flex items-center"><ArrowRight className="w-3 h-3 mr-1 inline transform transition-transform group-open:rotate-90" /> Verified Nodes ({streamingSources.length})</summary>
                                          <div className="mt-3 grid grid-cols-1 gap-3 border-l-2 border-white/10 pl-4 ml-1">
                                             {streamingSources.map((src, i) => (
                                                <div key={`stream-source-${i}`} className="flex flex-col space-y-1">
                                                   <button onClick={() => pdfViewerRef.current?.setPage(src.pageNumber)} className="w-fit text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded uppercase font-semibold hover:bg-emerald-500/20 transition-colors">Page {src.pageNumber}</button>
                                                   <p className="text-sm text-neutral-400 leading-relaxed line-clamp-3">"{src.text}"</p>
                                                </div>
                                             ))}
                                          </div>
                                       </details>
                                    )}
                                 </div>
                              </div>
                           </motion.div>
                        )}
                        
                        <div ref={messagesEndRef} className="h-6 shrink-0 w-full" />
                    </div>
                 </div>

                 <div className="absolute bottom-28 left-0 right-0 flex justify-center pointer-events-none z-50">
                    <AnimatePresence>
                      {(!engineReady || appState === 'initializing') && (
                        <motion.div initial={{ opacity: 0, y: 15, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="bg-[#1a1a1a] border border-white/10 shadow-2xl rounded-2xl p-4 flex flex-col space-y-3 pointer-events-auto min-w-[260px]">
                           <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-300 font-medium flex items-center tracking-wide"><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-emerald-500"/> {!engineReady ? 'Downloading Engine...' : 'Mapping Document...'}</span>
                              <span className="text-xs font-mono text-emerald-500 font-semibold">{!engineReady ? engineProgressPercent : vectorProgress}%</span>
                           </div>
                           <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                             <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${!engineReady ? engineProgressPercent : vectorProgress}%` }} />
                           </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>

                 <div className="w-full p-6 pt-4 bg-[#050505] border-t border-white/5 flex flex-col items-center shrink-0 z-20 relative">
                    <form onSubmit={handleSearch} className="w-full max-w-3xl relative flex items-center bg-[#1a1a1a] border border-white/10 rounded-xl p-1.5 shadow-xl focus-within:border-emerald-500/50 transition-colors">
                       <input ref={inputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} disabled={isTyping || !engineReady || appState === 'initializing'} placeholder={!engineReady ? "Initializing WebGPU Engine..." : isTyping ? "Synthesizing response..." : "Ask Axiom-Zero..."} className="flex-1 bg-transparent text-white text-[15px] py-3.5 px-4 outline-none disabled:opacity-50 placeholder:text-neutral-500 font-open-sans" />
                       
                       {isTyping ? (
                           <button type="button" onClick={stopGeneration} className="p-3 mr-1 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all border border-red-500/20" title="Stop Generation"><Square className="w-4 h-4 fill-current" /></button>
                       ) : (
                           <button type="submit" disabled={!searchQuery.trim() || !engineReady || appState === 'initializing'} className="p-3 mr-1 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-500 shadow-md" aria-label="Send Query"><Zap className="w-4 h-4 fill-current" /></button>
                       )}
                    </form>
                    <div className="mt-3 text-[10.5px] text-neutral-600 text-center font-medium tracking-wide">Axiom-Zero runs 100% locally. No data leaves your device.</div>
                 </div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}

