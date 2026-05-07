import { motion } from 'framer-motion';

interface DownloadScreenProps {
  progressPercent: number;
  progressText: string;
  modelSize: string;
  timeLeft: string;
}

export default function DownloadScreen({ progressPercent, progressText, modelSize, timeLeft }: DownloadScreenProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black font-sans text-white"
    >
      {/* Top Right Indicator */}
      <div className="absolute top-8 right-10 flex items-center space-x-2 text-zinc-400 text-xs tracking-wider">
        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
        <span>initializing</span>
      </div>

      <div className="w-full max-w-md flex flex-col items-center">
        <h3 className="text-zinc-300 text-lg font-medium mb-2 tracking-wide">Axiom-Zero</h3>
        <h1 className="text-white text-2xl font-semibold mb-12 tracking-tight">Downloading Transformer Model</h1>

        {/* Minimalist Progress Bar */}
        <div className="w-full max-w-[320px] h-2 bg-zinc-800 rounded-full overflow-hidden mb-6">
          <motion.div 
            className="h-full bg-white transition-all duration-300 ease-out rounded-full" 
            style={{ width: `${progressPercent}%` }} 
          />
        </div>

        {/* Real-time Stats Grid */}
        <div className="w-full max-w-[320px] grid grid-cols-2 gap-4 text-xs font-mono text-zinc-500">
           <div className="text-left space-y-1">
              <p className="truncate">{progressText || 'Allocating memory...'}</p>
              <p>Size: {modelSize}</p>
           </div>
           <div className="text-right space-y-1">
              <p>{progressPercent}%</p>
              <p>ETA: {timeLeft}</p>
           </div>
        </div>
      </div>
    </motion.div>
  );
}