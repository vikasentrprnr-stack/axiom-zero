import React from 'react';
import { Cpu, Database, Zap, Shield, AlertTriangle, ArrowLeft, X } from 'lucide-react';
import Link from 'next/link';

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-open-sans selection:bg-emerald-500/30">
      
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0a0a] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
           <div className="flex items-center space-x-4">
              <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-neutral-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <span className="font-outfit text-xl font-medium tracking-wide">Axiom-Zero Documentation</span>
           </div>
           <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-md text-emerald-400">
              <Shield className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Privacy-First</span>
           </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-16">
        
        {/* Intro */}
        <section className="space-y-4">
          <h1 className="font-outfit text-4xl font-semibold">How Axiom-Zero Works</h1>
          <p className="text-neutral-400 text-lg leading-relaxed">
            Axiom-Zero is a 100% local, client-side Retrieval-Augmented Generation (RAG) engine. Unlike traditional AI applications, no data ever leaves your device. The entire pipeline—from document parsing to neural generation—executes directly inside your browser.
          </p>
        </section>

        {/* Warning Card */}
        <section className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start">
           <div className="p-3 bg-amber-500/10 rounded-full shrink-0">
             <AlertTriangle className="w-6 h-6 text-amber-500" />
           </div>
           <div className="space-y-3">
              <h2 className="font-outfit text-xl font-semibold text-amber-500">System Requirements & Caution</h2>
              <p className="text-neutral-300 text-[15px] leading-relaxed">
                Running Large Language Models locally requires substantial computational power. Axiom-Zero utilizes the <strong>WebGPU API</strong> to offload calculations to your graphics card.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[14.5px] text-neutral-400">
                <li><strong>Hardware:</strong> Apple Silicon (M1/M2/M3) or dedicated Nvidia/AMD GPUs are strongly recommended.</li>
                <li><strong>Memory Limits:</strong> Selecting the <strong>Gemma 3 (4B)</strong> model requires at least 16GB of System RAM. If your browser crashes during load, switch to Llama 3.2 (1B).</li>
                <li><strong>Download Speeds:</strong> The first time you use a model, it must be downloaded to your browser cache (approx 1GB to 2.6GB). Depending on your internet speed, this can take anywhere from 30 seconds to 5 minutes. Subsequent loads are instantaneous.</li>
              </ul>
           </div>
        </section>

        {/* Architecture Grid */}
        <section className="space-y-6">
           <h2 className="font-outfit text-2xl font-semibold border-b border-white/10 pb-3">The Architecture</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#121212] border border-white/5 p-6 rounded-xl space-y-3">
                 <Cpu className="w-5 h-5 text-emerald-500" />
                 <h3 className="font-medium text-white">The Neural Engine</h3>
                 <p className="text-sm text-neutral-400 leading-relaxed">
                   Powered by the latest open-source models: <strong>Llama 3.2</strong> and Google's <strong>Gemma 2 & 3</strong>. The model weights are quantized securely to your browser's local storage. 
                 </p>
              </div>
              <div className="bg-[#121212] border border-white/5 p-6 rounded-xl space-y-3">
                 <Database className="w-5 h-5 text-emerald-500" />
                 <h3 className="font-medium text-white">Hybrid RAG</h3>
                 <p className="text-sm text-neutral-400 leading-relaxed">
                   PDFs are converted into vectors via background Web Workers. We use a combination of Cosine Similarity and Term-Frequency boosting to find exact text matches.
                 </p>
              </div>
           </div>
        </section>

        {/* Best Practices */}
        <section className="space-y-6 pb-20">
           <h2 className="font-outfit text-2xl font-semibold border-b border-white/10 pb-3">Getting the Best Results</h2>
           
           <div className="space-y-8">
              <div>
                <h3 className="font-medium text-lg text-white mb-2 flex items-center"><Zap className="w-4 h-4 mr-2 text-emerald-500"/> Dos</h3>
                <ul className="list-disc pl-6 space-y-2 text-neutral-400 text-[15px] leading-relaxed">
                   <li><strong>Ask specific questions:</strong> The mathematical search engine looks for semantic density. "What is the formula for lattice hopping on page 4?" works better than "Summarize the physics chapter."</li>
                   <li><strong>Use clean PDFs:</strong> Documents that are native PDFs (text-selectable) map significantly faster and more accurately than scanned images or heavily watermarked files.</li>
                   <li><strong>Leverage the Chain-of-Thought:</strong> The AI is programmed to generate a visible "Reasoning Process." Review this dropdown to verify the model's logic.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-lg text-white mb-2 flex items-center"><X className="w-4 h-4 mr-2 text-red-500"/> Don'ts</h3>
                <ul className="list-disc pl-6 space-y-2 text-neutral-400 text-[15px] leading-relaxed">
                   <li><strong>Avoid broad, ungrounded queries:</strong> If you ask a question outside the scope of the document, the strict system prompt will force the AI to reply: <em>"The provided document does not contain this information."</em></li>
                   <li><strong>Do not close the tab during initialization:</strong> The initial "Mapping Document" phase is calculating thousands of mathematical vectors. Closing the tab will corrupt the IndexedDB save state.</li>
                </ul>
              </div>
           </div>
        </section>

      </main>
    </div>
  );
}