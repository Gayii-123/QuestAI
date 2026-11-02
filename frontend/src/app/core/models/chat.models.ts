export interface InspectionFindingPreview {
  id?: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  location?: string;
  recommendation?: string;
  confidenceScore?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  structuredInspection?: {
    summary?: string;
    overallRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
    findings?: InspectionFindingPreview[];
    modelIdentifier?: string;
    isMock?: boolean;
  };
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: Date;
  previewSnippet: string;
  messages: ChatMessage[];
}

export interface SuggestionPrompt {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: 'document' | 'evidence' | 'response';
}
