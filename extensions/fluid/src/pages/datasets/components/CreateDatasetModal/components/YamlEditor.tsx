import React, { useState, useEffect } from 'react';
import { Alert } from '@kubed/components';
import { CodeEditor } from '@kubed/code-editor';
import styled from 'styled-components';
import { DatasetFormData } from '../types';
import yaml from 'js-yaml';

declare const t: (key: string, options?: any) => string;

interface YamlEditorProps {
  formData: DatasetFormData;
  onDataChange: (data: DatasetFormData) => void;
  onValidationChange: (isValid: boolean) => void;
}

const EditorContainer = styled.div`
  padding: 24px;
  height: 600px;
  display: flex;
  flex-direction: column;
`;

const EditorHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const EditorTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #242e42;
  margin: 0;
`;

const EditorWrapper = styled.div`
  flex: 1;
  border: 1px solid #e3e9ef;
  border-radius: 4px;
  overflow: hidden;
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const YamlEditor: React.FC<YamlEditorProps> = ({
  formData,
  onDataChange,
  onValidationChange,
}) => {
  const [yamlContent, setYamlContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 将表单数据转换为YAML
  const formDataToYaml = (data: DatasetFormData) => {
    const dataset = {
      apiVersion: 'data.fluid.io/v1alpha1',
      kind: 'Dataset',
      metadata: {
        name: data.name || '',
        namespace: data.namespace || 'default',
        labels: data.labels || {},
        ...(data.description && {
          annotations: {
            'data.fluid.io/description': data.description,
          },
        }),
      },
      spec: {
        mounts: data.mounts || [],
        runtimes: [
          {
            name: data.runtimeName || data.name || '',
            namespace: data.namespace || 'default',
          },
        ],
      },
    };

    const runtime = {
      apiVersion: 'data.fluid.io/v1alpha1',
      kind: data.runtimeType || 'AlluxioRuntime',
      metadata: {
        name: data.runtimeName || data.name || '',
        namespace: data.namespace || 'default',
      },
      spec: {
        replicas: data.replicas || 1,
        tieredstore: data.tieredStore || {
          levels: [
            {
              level: 0,
              mediumtype: 'MEM',
              quota: '2Gi',
            },
          ],
        },
      },
    };

    const resources = [dataset, runtime];

    // 如果启用了数据预热，添加DataLoad资源
    if (data.enableDataLoad && data.dataLoadConfig) {
      const dataLoad: any = {
        apiVersion: 'data.fluid.io/v1alpha1',
        kind: 'DataLoad',
        metadata: {
          name: `${data.name}-dataload`,
          namespace: data.namespace || 'default',
          labels: {},
        },
        spec: {
          dataset: {
            name: data.name || '',
            namespace: data.namespace || 'default',
          },
          loadMetadata: data.dataLoadConfig.loadMetadata,
          target: data.dataLoadConfig.target || [],
          policy: data.dataLoadConfig.policy || 'Once',
          ...(data.dataLoadConfig.schedule && { schedule: data.dataLoadConfig.schedule }),
        },
      };
      resources.push(dataLoad);
    }

    return resources.map(resource => yaml.dump(resource)).join('---\n');
  };

  // 将YAML转换为表单数据
  const yamlToFormData = (yamlStr: string): DatasetFormData | null => {
    try {
      const documents = yamlStr.split('---').filter(doc => doc.trim());
      const resources = documents.map(doc => yaml.load(doc.trim()));
      
      const dataset = resources.find(r => r.kind === 'Dataset');
      const runtime = resources.find(r => r.kind?.endsWith('Runtime'));
      const dataLoad = resources.find(r => r.kind === 'DataLoad');

      if (!dataset) {
        throw new Error('Dataset resource not found');
      }

      const formData: DatasetFormData = {
        name: dataset.metadata?.name || '',
        namespace: dataset.metadata?.namespace || 'default',
        description: dataset.metadata?.annotations?.['data.fluid.io/description'] || '',
        labels: dataset.metadata?.labels || {},
        runtimeType: runtime?.kind || 'AlluxioRuntime',
        runtimeName: runtime?.metadata?.name || '',
        replicas: runtime?.spec?.replicas || 1,
        tieredStore: runtime?.spec?.tieredstore,
        mounts: dataset.spec?.mounts || [],
        enableDataLoad: !!dataLoad,
        dataLoadConfig: dataLoad ? {
          loadMetadata: dataLoad.spec?.loadMetadata || true,
          target: dataLoad.spec?.target || [],
          policy: dataLoad.spec?.policy || 'Once',
          schedule: dataLoad.spec?.schedule,
        } : undefined,
      };

      return formData;
    } catch (err) {
      console.error('YAML parsing error:', err);
      return null;
    }
  };

  // 初始化YAML内容
  useEffect(() => {
    const yaml = formDataToYaml(formData);
    setYamlContent(yaml);
  }, []);

  // 处理YAML内容变化
  const handleYamlChange = (value: string) => {
    setYamlContent(value);
    setError(null);

    try {
      const newFormData = yamlToFormData(value);
      if (newFormData) {
        onDataChange(newFormData);
        onValidationChange(true);
      } else {
        onValidationChange(false);
        setError(t('YAML_PARSE_ERROR'));
      }
    } catch (err) {
      onValidationChange(false);
      setError((err as Error).message || t('YAML_PARSE_ERROR'));
    }
  };

  // // 下载YAML文件
  // const handleDownload = () => {
  //   const blob = new Blob([yamlContent], { type: 'text/yaml' });
  //   const url = URL.createObjectURL(blob);
  //   const a = document.createElement('a');
  //   a.href = url;
  //   a.download = `${formData.name || 'dataset'}.yaml`;
  //   document.body.appendChild(a);
  //   a.click();
  //   document.body.removeChild(a);
  //   URL.revokeObjectURL(url);
  // };

  // // 上传YAML文件
  // const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = event.target.files?.[0];
  //   if (file) {
  //     const reader = new FileReader();
  //     reader.onload = (e) => {
  //       const content = e.target?.result as string;
  //       handleYamlChange(content);
  //     };
  //     reader.readAsText(file);
  //   }
  //   // 清空input值，允许重复上传同一文件
  //   event.target.value = '';
  // };

  // // 重置为表单数据
  // const handleReset = () => {
  //   const yaml = formDataToYaml(formData);
  //   setYamlContent(yaml);
  //   setError(null);
  //   onValidationChange(true);
  // };

  return (
    <EditorContainer>
      <EditorHeader>
        <EditorTitle>{t('YAML_CONFIGURATION')}</EditorTitle>
      </EditorHeader>
      {error && (
        <Alert
          type="error"
          title={t('YAML_ERROR')}
          style={{ marginBottom: 16 }}
        >
          {error}  {'>_<'}
        </Alert>
      )}

      <EditorWrapper>
        <CodeEditor
          value={yamlContent}
          onChange={handleYamlChange}
        />
      </EditorWrapper>

      {/* <HiddenFileInput
        id="yaml-file-input"
        type="file"
        accept=".yaml,.yml"
        onChange={handleUpload}
      /> */}
    </EditorContainer>
  );
};

export default YamlEditor;
