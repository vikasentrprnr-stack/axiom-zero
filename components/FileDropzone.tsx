import { useState, useCallback } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { TextChunk } from '@/types/app';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface FileDropzoneProps { onChunksIngested: (chunks: TextChunk[], file: File) => void; }

export default function FileDropzone({ onChunksIngested }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processPDF = async (file: File) => {
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const chunks: TextChunk[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: any) => item.str).join(' ');
        const cleanText = text.replace(/\s+/g, ' ').trim();
        if (cleanText.length > 50) chunks.push({ text: cleanText, pageNumber: i, documentName: file.name });
      }
      onChunksIngested(chunks, file);
    } catch (error) {
      alert("Failed to parse PDF."); setIsProcessing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') processPDF(file);
  }, []);

  return (
    <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} className={`w-full max-w-2xl aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-10 transition-all duration-300 relative overflow-hidden bg-[#0a0a0a] ${isDragging ? 'border-emerald-500 bg-emerald-500/5' : 'border-white/10 hover:border-white/20'}`}>
      {isProcessing ? (
        <div className="flex flex-col items-center space-y-4 animate-fade-in">
           <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
           <h3 className="text-xl font-outfit text-white font-medium">Extracting Geometry...</h3>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-4 text-center pointer-events-none">
          <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center shadow-lg border border-white/5">
             <UploadCloud className="w-8 h-8 text-neutral-400" />
          </div>
          <div>
             <h3 className="text-2xl font-outfit text-white font-medium mb-2">Initialize Workspace</h3>
             <p className="text-neutral-500 text-sm max-w-sm mx-auto leading-relaxed">Drop your research PDF here to map its neural vectors locally.</p>
          </div>
        </div>
      )}
      <input type="file" accept="application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if(f) processPDF(f); }} disabled={isProcessing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
    </div>
  );
}