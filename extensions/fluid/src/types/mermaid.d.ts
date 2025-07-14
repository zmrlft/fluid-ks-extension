interface MermaidConfig {
  startOnLoad?: boolean;
  theme?: string;
  flowchart?: {
    useMaxWidth?: boolean;
    htmlLabels?: boolean;
    curve?: string;
  };
}

interface Mermaid {
  initialize: (config: MermaidConfig) => void;
  contentLoaded: () => void;
}

declare global {
  interface Window {
    mermaid: Mermaid;
  }
} 