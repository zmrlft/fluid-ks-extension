/*
 * Dataset YAML component
 */

import React, { useState, useEffect } from 'react';
import { useCacheStore as useStore } from '@ks-console/shared';
import { Card, Button } from '@kubed/components';
import styled from 'styled-components';
import yaml from 'js-yaml';

// 全局t函数声明
declare const t: (key: string, options?: any) => string;

const YAMLContent = styled.pre`
  background-color: #f9fbfd;
  border: 1px solid #e9e9e9;
  border-radius: 4px;
  padding: 12px;
  font-family: Monaco, Menlo, Consolas, "Courier New", monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  max-height: 600px;
`;

const ButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
`;

const YAMLView = () => {
  const [props] = useStore('DatasetDetailProps');
  const { detail } = props;
  const [yamlContent, setYamlContent] = useState('');

  useEffect(() => {
    if (detail) {
      try {
        // 转换对象为YAML
        console.log('正在将detail转换为YAML', detail);
        const yamlStr = yaml.dump(detail, { 
          indent: 2,
          lineWidth: -1,
          noRefs: true,
        });
        setYamlContent(yamlStr);
      } catch (error) {
        console.error('Failed to convert to YAML:', error);
        setYamlContent('Error converting to YAML');
      }
    }
  }, [detail]);

  const handleDownload = () => {
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${detail.metadata?.name || 'dataset'}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card sectionTitle={t('YAML')}>
      <ButtonWrapper>
        <Button onClick={handleDownload}>{t('DOWNLOAD')}</Button>
      </ButtonWrapper>
      <YAMLContent>{yamlContent}</YAMLContent>
    </Card>
  );
};

export default YAMLView; 