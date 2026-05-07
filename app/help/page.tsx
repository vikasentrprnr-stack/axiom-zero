'use client';

import { 
  Cpu, Database, ShieldCheck, FileText, Share2, 
  AlertTriangle, ArrowLeft, Terminal, ServerOff, Zap,
  CheckCircle, ChevronRight
} from 'lucide-react';
import Link from 'next/link';

export default function HelpDocumentation() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200 font-sans selection:bg-blue-500/30">
      
      {/* Navbar */}
      <nav className="h-16 border-b border-white/5 flex items-center px-8 bg-[#0a0a0a] sticky top-0 z-50">
        <Link href="/" className="flex items-center text-sm font-medium text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Workspace
        </Link>
        <div className="ml-auto flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">System Online</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12 lg:py-20 space-y-20">
        
        {/* Hero Section */}
        <section className="text-center space-y-6">
          <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight text-white">
            Axiom-Zero Documentation
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Welcome to the ultimate local AI workspace. Axiom-Zero leverages WebGPU and multi-threaded architecture to run elite neural networks directly on your silicon—no cloud required.
          </p>
        </section>

        {/* Core Architecture Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-[#121212] border border-white/5 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <ServerOff className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-white">100% Local</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">Zero data leaves your machine. Your documents, chat history, and semantic vectors are processed entirely on your local GPU.</p>
          </div>
          <div className="p-6 rounded-3xl bg-[#121212] border border-white/5 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Zap className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-medium text-white">WebGPU Accelerated</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">By compiling transformer models directly into hardware-accelerated shaders, Axiom-Zero achieves native application speeds in the browser.</p>
          </div>
          <div className="p-6 rounded-3xl bg-[#121212] border border-white/5 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <ShieldCheck className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-medium text-white">Data Sovereignty</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">Your data is stored securely in IndexedDB. Only you hold the keys. If you clear your cache, the data is mathematically destroyed.</p>
          </div>
        </section>

        {/* System Requirements */}
        <section className="space-y-8">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-2xl font-semibold text-white flex items-center">
              <Cpu className="w-6 h-6 mr-3 text-zinc-500" /> Hardware Requirements
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-4">
                <h4 className="font-medium text-blue-400">Gemma 2 (2B Parameters)</h4>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li className="flex items-start"><CheckCircle className="w-4 h-4 mr-2 text-emerald-500 shrink-0 mt-0.5" /> Desktop operating system (Mac/Windows)</li>
                  <li className="flex items-start"><CheckCircle className="w-4 h-4 mr-2 text-emerald-500 shrink-0 mt-0.5" /> WebGPU-compatible browser (Chrome, Edge, Brave)</li>
                  <li className="flex items-start"><CheckCircle className="w-4 h-4 mr-2 text-emerald-500 shrink-0 mt-0.5" /> Minimum 8GB of System RAM</li>
                  <li className="flex items-start"><CheckCircle className="w-4 h-4 mr-2 text-emerald-500 shrink-0 mt-0.5" /> 2GB of available disk space for caching</li>
                </ul>
             </div>
             <div className="space-y-4">
                <h4 className="font-medium text-purple-400">Llama 3.2 (3B Parameters)</h4>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li className="flex items-start"><CheckCircle className="w-4 h-4 mr-2 text-emerald-500 shrink-0 mt-0.5" /> Dedicated GPU or Apple Silicon (M1/M2/M3/M4)</li>
                  <li className="flex items-start"><CheckCircle className="w-4 h-4 mr-2 text-emerald-500 shrink-0 mt-0.5" /> WebGPU-compatible browser</li>
                  <li className="flex items-start"><CheckCircle className="w-4 h-4 mr-2 text-emerald-500 shrink-0 mt-0.5" /> Minimum 16GB of System RAM</li>
                  <li className="flex items-start"><CheckCircle className="w-4 h-4 mr-2 text-emerald-500 shrink-0 mt-0.5" /> 3GB of available disk space for caching</li>
                </ul>
             </div>
          </div>
        </section>

        {/* Features Guide */}
        <section className="space-y-8">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-2xl font-semibold text-white flex items-center">
              <Terminal className="w-6 h-6 mr-3 text-zinc-500" /> Usage Guide
            </h2>
          </div>
          
          <div className="space-y-6">
            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
              <h3 className="text-lg font-medium text-white mb-2 flex items-center"><FileText className="w-5 h-5 mr-2 text-blue-400" /> Document Vectorization (RAG)</h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                When you drop a PDF into Axiom-Zero, it doesn't just read the text. It uses an embedded Web Worker to chunk the document and map the sentences into high-dimensional semantic space. 
                <br/><br/>
                <strong>Best Practice:</strong> Keep PDFs under 50 pages for optimal memory safety. Ensure the PDF is text-selectable (not scanned images).
              </p>
            </div>

            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
              <h3 className="text-lg font-medium text-white mb-2 flex items-center"><Share2 className="w-5 h-5 mr-2 text-emerald-400" /> Serverless Sharing</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Because Axiom-Zero has no cloud database, sharing a chat requires compressing the entire conversation into a Base64 URL string. When you click "Share Link", the data is mathematically encoded into the link itself. Anyone opening the link decodes the data locally on their machine.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ & Troubleshooting */}
        <section className="space-y-8 pb-12">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-2xl font-semibold text-white flex items-center">
              <AlertTriangle className="w-6 h-6 mr-3 text-zinc-500" /> Troubleshooting & FAQ
            </h2>
          </div>

          <div className="space-y-4">
            
            <details className="group p-5 bg-[#121212] rounded-2xl border border-white/5 [&_summary::-webkit-details-marker]:hidden cursor-pointer transition-colors hover:border-white/10">
              <summary className="flex items-center justify-between font-medium text-white outline-none">
                Why is the model downloading every time I refresh?
                <ChevronRight className="w-5 h-5 text-zinc-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className="pt-4 text-sm text-zinc-400 leading-relaxed border-t border-white/5 mt-4">
                This happens if a previous download was interrupted or corrupted. Your browser is detecting a broken cache and attempting to fix it. To resolve this permanently: go to your sidebar, click <strong>"Clear Local Cache"</strong>, and let the model download to 100% without refreshing or closing the tab.
              </div>
            </details>

            <details className="group p-5 bg-[#121212] rounded-2xl border border-white/5 [&_summary::-webkit-details-marker]:hidden cursor-pointer transition-colors hover:border-white/10">
              <summary className="flex items-center justify-between font-medium text-white outline-none">
                The AI is only generating a "Thinking Process" but no answer.
                <ChevronRight className="w-5 h-5 text-zinc-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className="pt-4 text-sm text-zinc-400 leading-relaxed border-t border-white/5 mt-4">
                Local models have a strict memory limit (Context Window). If you ask a highly complex question about a massive PDF, the AI might exhaust its memory limits just "thinking" about the answer. We have implemented strict prompts to prevent this, but if it happens, try breaking your question down into smaller, more specific parts.
              </div>
            </details>

            <details className="group p-5 bg-[#121212] rounded-2xl border border-white/5 [&_summary::-webkit-details-marker]:hidden cursor-pointer transition-colors hover:border-white/10">
              <summary className="flex items-center justify-between font-medium text-white outline-none">
                Why does my phone say "Desktop Required"?
                <ChevronRight className="w-5 h-5 text-zinc-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className="pt-4 text-sm text-zinc-400 leading-relaxed border-t border-white/5 mt-4">
                Axiom-Zero requires the WebGPU API to execute neural networks. Currently, iOS Safari and Android Chrome do not fully support WebGPU at the memory capacities required to run multi-billion parameter LLMs. You must use a desktop OS. However, <strong>Shared Links</strong> can be viewed on any mobile device.
              </div>
            </details>

            <details className="group p-5 bg-[#121212] rounded-2xl border border-white/5 [&_summary::-webkit-details-marker]:hidden cursor-pointer transition-colors hover:border-white/10">
              <summary className="flex items-center justify-between font-medium text-white outline-none">
                What does "Clear Local Cache" actually do?
                <ChevronRight className="w-5 h-5 text-zinc-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className="pt-4 text-sm text-zinc-400 leading-relaxed border-t border-white/5 mt-4">
                It executes a complete hard reset of the application. It deletes your IndexedDB (where PDFs and chat history are saved), wipes your LocalStorage (where your name and model preferences are saved), and forces the browser to drop the AI model weights from memory. Use this if the app ever feels "stuck".
              </div>
            </details>

          </div>
        </section>

      </main>
    </div>
  );
}