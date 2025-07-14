import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';

// 声明mermaid全局变量类型
declare global {
  interface Window {
    mermaid?: {
      initialize: (config: any) => void;
      render: (id: string, code: string, callback: (svg: string) => void) => void;
    };
  }
}

const DiagramContainer = styled.div`
  width: 100%;
  overflow: auto;
`;

interface MermaidDiagramProps {
  code: string;
  className?: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ code, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramId = `mermaid-${Math.random().toString(36).substring(2, 11)}`;

  useEffect(() => {
    // 如果没有代码或DOM元素，则不执行
    if (!code || !containerRef.current) return;

    // 动态加载Mermaid库
    const loadMermaid = async () => {
      if (!window.mermaid) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js';
        script.async = true;
        script.onload = renderDiagram;
        document.body.appendChild(script);
      } else {
        renderDiagram();
      }
    };

    // 渲染图表
    const renderDiagram = () => {
      if (window.mermaid) {
        try {
          window.mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            flowchart: {
              useMaxWidth: true,
              htmlLabels: true,
              curve: 'basis'
            },
            securityLevel: 'loose'
          });

          // 清除容器内容
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
            
            // 渲染新图表
            window.mermaid.render(
              diagramId,
              code,
              (svg) => {
                if (containerRef.current) {
                  containerRef.current.innerHTML = svg;
                }
              }
            );
          }
        } catch (error) {
          console.error('Failed to render mermaid diagram:', error);
          if (containerRef.current) {
            containerRef.current.innerHTML = `<div style="color: red;">Error rendering diagram</div>`;
          }
        }
      }
    };

    loadMermaid();
  }, [code, diagramId]);

  return <DiagramContainer ref={containerRef} className={className} />;
};

export default MermaidDiagram; 