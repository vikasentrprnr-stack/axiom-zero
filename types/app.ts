// types/app.ts
export type ApplicationState = 'ready' | 'initializing' | 'active';

export interface TextChunk {
  text: string;
  pageNumber: number;
  documentName: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
}