import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';

export interface DocumentViewerHandle { setPage: (page: number) => void; }
interface DocumentViewProps { pdfDocument: any; documentName: string; }

const DocumentView = forwardRef<DocumentViewerHandle, DocumentViewProps>(({ pdfDocument, documentName }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);

  useImperativeHandle(ref, () => ({
    setPage: (page: number) => { if (page >= 1 && page <= numPages) setCurrentPage(page); }
  }));

  useEffect(() => {
    if (pdfDocument) { setNumPages(pdfDocument.numPages); setCurrentPage(1); }
  }, [pdfDocument]);

  useEffect(() => {
    let renderTask: any = null;
    const renderPage = async () => {
      if (!pdfDocument || !canvasRef.current) return;
      try {
        const page = await pdfDocument.getPage(currentPage);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const pixelRatio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.width = viewport.width * pixelRatio; canvas.height = viewport.height * pixelRatio;
        canvas.style.width = '100%'; canvas.style.height = 'auto';
        ctx.scale(pixelRatio, pixelRatio);
        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (err) {}
    };
    renderPage();
    return () => { if (renderTask) renderTask.cancel(); };
  }, [pdfDocument, currentPage]);

  if (!pdfDocument) return null;

  return (
    <div className="flex flex-col h-full w-full bg-[#080808] relative">
      <div className="h-14 border-b border-neutral-900 flex items-center justify-between px-4 bg-black/60 backdrop-blur-md z-10 flex-shrink-0">
        <div className="flex items-center space-x-2 bg-neutral-950 border border-neutral-800 rounded-lg p-1">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="p-1 rounded bg-neutral-900 text-neutral-400 hover:text-white disabled:opacity-50 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-[11px] font-mono text-neutral-400 w-16 text-center tabular-nums font-medium">{currentPage} / {numPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage >= numPages} className="p-1 rounded bg-neutral-900 text-neutral-400 hover:text-white disabled:opacity-50 transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center space-x-2 max-w-[200px] overflow-hidden"><FileText className="w-3.5 h-3.5 text-emerald-500/50 flex-shrink-0" /><span className="text-[11px] font-mono text-neutral-500 truncate">{documentName}</span></div>
      </div>
      <div className="flex-1 overflow-auto bg-[#0a0a0a] flex justify-center p-4 lg:p-8 scrollbar-hide">
         <div className="relative w-full max-w-3xl bg-white shadow-2xl transition-opacity duration-300 mx-auto self-start"><canvas ref={canvasRef} className="block w-full h-auto" /></div>
      </div>
    </div>
  );
});
DocumentView.displayName = 'DocumentView';
export default DocumentView;