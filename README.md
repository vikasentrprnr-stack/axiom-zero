# Axiom-Zero
**Privacy-First, Local AI Research Engine powered by WebGPU**
**Axiom-Zero** is a highly sophisticated, 100% client-side Retrieval-Augmented Generation (RAG) application. It allows users to chat with their PDF documents using a locally running Large Language Model (**Llama-3.2-1B-Instruct**).
Unlike traditional AI wrappers, Axiom-Zero requires **no API keys, no cloud servers, and no subscriptions**. Every step of the pipeline—from document parsing and vector embedding to semantic search and AI generation—happens directly on the user's local hardware via the browser's WebGPU API. Zero data ever leaves the device.
## Core Features
 * **Zero-Latency Local LLM:** Runs Llama 3.2 entirely in the browser using @mlc-ai/web-llm, utilizing local GPU acceleration for fast, private inference.
 * **100% Client-Side RAG:** Full PDF ingestion, semantic chunking, and vector search executed on-device without external database calls.
 * **Dynamic Context Routing:** The system intelligently classifies user queries. For history/theory, it generates standard markdown. For programming/math, it triggers a DeepSeek-style <think> Chain-of-Thought reasoning loop before generating exact code blocks or LaTeX equations.
 * **Seamless UI/UX:** Built with Framer Motion spring physics, featuring buttery-smooth 60fps draggable split-panes, hover-reveal menus, and real-time processing indicators.
 * **Premium AST Markdown Rendering:** Flawlessly renders syntax-highlighted code blocks (via Prism) and mathematical formulas (via KaTeX).
 * **Persistent Local Memory:** Caches vectorized documents and conversational history securely in the browser's IndexedDB, allowing users to switch contexts instantly.
##  System Architecture & RAG Pipeline
Axiom-Zero employs a meticulously engineered, multi-threaded RAG pipeline to prevent UI blocking during heavy mathematical operations.
 1. **Document Ingestion & Sanitization:** PDFs are parsed locally via pdfjs-dist. The extracted text passes through a regex-based "Sanitization Engine" to strip out useless metadata, headers, footers, and copyright symbols, ensuring the AI only reads pure data.
 2. **Background Vectorization:** Text is semantically chunked and passed to a dedicated **Web Worker**. The worker converts the text into mathematical embeddings and securely stores them in IndexedDB.
 3. **Semantic Retrieval (Cosine Similarity):** When a user submits a query, it is vectorized. The system calculates the Cosine Similarity against all document chunks, applying a strict accuracy threshold (> 0.18) to filter out irrelevant data and return the top 3 highest-density nodes.
 4. **Smart Memory Threading:** To prevent "AI Amnesia", the system injects the last 4 chat messages into the context window. If a user asks a short follow-up (e.g., *"Show me the code"*), the router dynamically prepends the previous query to the vector search to maintain >99% semantic retrieval accuracy.
 5. **Generation & Anti-Hallucination:** The Llama-3 model streams the answer token-by-token. A strict system prompt serves as an absolute logic gate, forcing the model to stick strictly to the document context and preventing it from hallucinating external information.
##  Advanced Engineering Highlights
 * **Defeating React Stale Closures:** Background Web Workers in React notoriously trap state. This was solved by utilizing useRef as real-time memory portals, allowing the worker to access the active AI engine and chat history without triggering endless component re-renders.
 * **60FPS requestAnimationFrame Dragging:** Standard React state updates during mouse drag events cause massive layout jank. The split-pane resizer bypasses React's virtual DOM by wrapping width calculations inside native requestAnimationFrame loops, resulting in a flawless 60fps drag experience.
 * **CSS Stacking Context Control:** Engineered strict Flexbox columns (shrink-0) and relative anchoring to absolutely guarantee that floating UI elements (like the WebGPU loading overlay) never bleed under z-indexed input fields.
 * **AST Fallback Rendering:** Custom regex parsers inside ReactMarkdown automatically detect and surgically remove AI hallucinations (such as outputting "undefined" at the start of code blocks), ensuring the UI never breaks.
## 💻 Tech Stack
 * **Framework:** Next.js 14+ (App Router)
 * **Language:** TypeScript
 * **Local AI Engine:** @mlc-ai/web-llm
 * **Model:** Llama-3.2-1B-Instruct-q4f16_1-MLC
 * **Styling & Animation:** Tailwind CSS, Framer Motion
 * **Markdown & Math:** react-markdown, remark-math, rehype-katex, react-syntax-highlighter
 * **Data Processing:** Web Workers, IndexedDB, pdfjs-dist
 * **Icons:** Lucide React
##  Installation & Local Setup
Because Axiom-Zero runs locally, you can clone and run it in minutes.
**Prerequisites:**
You **must** use a modern desktop browser with WebGPU enabled (Google Chrome, Microsoft Edge, or Brave). Safari and mobile browsers do not currently have full WebGPU support.
 1. **Clone the repository:**
   ```bash
   git clone https://github.com/vikasrntrprnr-stack/axiom-zero.git
   cd axiom-zero
   
   ```
 2. **Install dependencies:**
   ```bash
   npm install
   
   ```
 3. **Start the development server:**
   ```bash
   npm run dev
   
   ```
 4. Open http://axiom-zero-gamma.vercel.app in your WebGPU-enabled browser.
## ⚠️ Important Production Notes
 * **Initial Model Caching:** The very first time you ask a question, the application will download the Llama 3.2 model weights into your browser's cache (approx. 800MB - 1GB). **This takes a few minutes depending on your internet speed.** Once cached, subsequent visits and queries will initialize almost instantly.
 * **Hardware Dependency:** Axiom-Zero leverages your device's GPU. Performance, token generation speed, and the ability to handle massive documents depend entirely on your local hardware. Apple Silicon (M1/M2/M3) and dedicated Nvidia/AMD GPUs will yield the best results.
## 📜 License
Currrently this Project's Liscence is not disclosed 
