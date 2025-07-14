/*
 * Dataset Resource Status component
 */

import React, { useMemo } from 'react';
import { useCacheStore as useStore } from '@ks-console/shared';
import { Card } from '@kubed/components';
import { get } from 'lodash';
import styled from 'styled-components';
import MermaidDiagram from '../../../../components/MermaidDiagram';

// 全局t函数声明
declare const t: (key: string, options?: any) => string;

// 定义Mount类型
interface Mount {
  mountPoint: string;
  name?: string;
  options?: Record<string, string>;
  path?: string;
  readOnly?: boolean;
  shared?: boolean;
}

// 定义Runtime类型
interface Runtime {
  name: string;
  namespace: string;
  type: string;
  category?: string;
  masterReplicas?: number;
}

const StatusItem = styled.div`
  margin-bottom: 12px;
`;

const StatusLabel = styled.div`
  font-weight: bold;
  margin-bottom: 4px;
`;

const StatusValue = styled.div`
  color: #333;
`;

const ProgressBar = styled.div<{ percent: number }>`
  width: 100%;
  height: 8px;
  background-color: #e9e9e9;
  border-radius: 4px;
  margin-top: 8px;
  
  &::after {
    content: '';
    display: block;
    width: ${props => `${props.percent}%`};
    height: 100%;
    background-color: #55bc8a;
    border-radius: 4px;
  }
`;

const TopologyContainer = styled.div`
  margin-top: 20px;
  margin-bottom: 20px;
`;

const TopologyTitle = styled.div`
  font-weight: bold;
  margin-bottom: 12px;
  font-size: 14px;
`;

const DiagramContainer = styled.div`
  background-color: #f9fbfd;
  border: 1px solid #e9e9e9;
  border-radius: 4px;
  padding: 12px;
  overflow: auto;
`;

const ResourceStatus = () => {
  const [props] = useStore('DatasetDetailProps');
  const { detail } = props;

  // 解析缓存百分比
  const getCachePercentage = () => {
    const percentage = get(detail, 'status.cacheStates.cachedPercentage', '0%');
    return parseInt(percentage.replace('%', ''), 10) || 0;
  };

  // 生成Mermaid图表代码
  const mermaidCode = useMemo(() => {
    if (!detail) return '';

    const datasetName = detail.metadata?.name || 'dataset';
    const namespace = detail.metadata?.namespace || 'default';
    const runtimes = get(detail, 'spec.runtimes', []) as Runtime[];
    
    let code = `graph TD\n`;
    code += `  Dataset["Dataset<br/>${datasetName}"]:::dataset\n`;
    
    // 添加数据源
    const mounts = get(detail, 'spec.mounts', []) as Mount[];
    if (mounts.length > 0) {
      mounts.forEach((mount, index) => {
        const mountName = mount.name || `Mount ${index + 1}`;
        const mountPoint = mount.mountPoint;
        code += `  DataSource${index}["Data Source<br/>${mountPoint}"]:::datasource\n`;
        code += `  DataSource${index} --> Dataset\n`;
      });
    }
    
    // 添加Runtime
    if (runtimes.length > 0) {
      runtimes.forEach((runtime, index) => {
        const runtimeType = runtime.type || 'Runtime';
        code += `  Runtime${index}["${runtimeType}<br/>${runtime.name}"]:::runtime\n`;
        code += `  Dataset --> Runtime${index}\n`;
        
        // 如果有masterReplicas，添加Master节点
        if (runtime.masterReplicas && runtime.masterReplicas > 0) {
          code += `  Master${index}["Master<br/>(${runtime.masterReplicas} replicas)"]:::master\n`;
          code += `  Runtime${index} --> Master${index}\n`;
        }
        
        // 添加Worker节点（假设每个Runtime都有Worker）
        code += `  Worker${index}["Worker<br/>(Distributed Cache)"]:::worker\n`;
        code += `  Runtime${index} --> Worker${index}\n`;
      });
    } else {
      // 如果没有Runtime，添加一个默认的
      code += `  NoRuntime["No Runtime<br/>Configured"]:::noruntime\n`;
      code += `  Dataset --> NoRuntime\n`;
    }
    
    // 添加应用节点
    code += `  Application["Applications<br/>(Pod consumers)"]:::application\n`;
    code += `  Dataset --> Application\n`;
    
    // 添加样式
    code += `\n  classDef dataset fill:#c4e3ff,stroke:#1890ff,stroke-width:2px\n`;
    code += `  classDef datasource fill:#f9f0ff,stroke:#722ed1,stroke-width:1px\n`;
    code += `  classDef runtime fill:#e6fffb,stroke:#13c2c2,stroke-width:2px\n`;
    code += `  classDef master fill:#f6ffed,stroke:#52c41a,stroke-width:1px\n`;
    code += `  classDef worker fill:#fff7e6,stroke:#fa8c16,stroke-width:1px\n`;
    code += `  classDef application fill:#fff1f0,stroke:#f5222d,stroke-width:1px\n`;
    code += `  classDef noruntime fill:#f0f0f0,stroke:#d9d9d9,stroke-width:1px\n`;
    
    return code;
  }, [detail]);

  return (
    <>
    <Card sectionTitle={t('RESOURCE_STATUS')}>
      <StatusItem>
        <StatusLabel>{t('STATUS')}</StatusLabel>
        <StatusValue>{get(detail, 'status.phase', '-')}</StatusValue>
      </StatusItem>
    </Card>
    
    
    <Card sectionTitle={t('DATASET_TOPOLOGY')}>
      <TopologyContainer>
        <TopologyTitle>{t('DATASET_TOPOLOGY')}</TopologyTitle>
        <DiagramContainer>
          <MermaidDiagram code={mermaidCode} />
        </DiagramContainer>
      </TopologyContainer>
      
      <StatusItem>
        <StatusLabel>{t('UFS_TOTAL')}</StatusLabel>
        <StatusValue>{get(detail, 'status.ufsTotal', '-')}</StatusValue>
      </StatusItem>
      
      <StatusItem>
        <StatusLabel>{t('CACHE_CAPACITY')}</StatusLabel>
        <StatusValue>{get(detail, 'status.cacheStates.cacheCapacity', '-')}</StatusValue>
      </StatusItem>
      
      <StatusItem>
        <StatusLabel>{t('CACHED')}</StatusLabel>
        <StatusValue>
          {get(detail, 'status.cacheStates.cached', '-')} 
          ({get(detail, 'status.cacheStates.cachedPercentage', '0%')})
        </StatusValue>
        <ProgressBar percent={getCachePercentage()} />
      </StatusItem>
      
      <StatusItem>
        <StatusLabel>{t('CACHE_HIT_RATIO')}</StatusLabel>
        <StatusValue>{get(detail, 'status.cacheStates.cacheHitRatio', '-')}</StatusValue>
      </StatusItem>
      
      <StatusItem>
        <StatusLabel>{t('TOTAL_FILES')}</StatusLabel>
        <StatusValue>{get(detail, 'status.fileNum', '-')}</StatusValue>
      </StatusItem>
      
      {detail?.spec?.mounts && detail.spec.mounts.length > 0 && (
        <StatusItem>
          <StatusLabel>{t('MOUNTS')}</StatusLabel>
          {detail.spec.mounts.map((mount: Mount, index: number) => (
            <div key={index} style={{ marginBottom: '8px', marginLeft: '12px' }}>
              <div><strong>{mount.name || `Mount ${index + 1}`}</strong></div>
              <div>{t('MOUNT_POINT')}: {mount.mountPoint}</div>
              <div>{t('PATH')}: {mount.path || '/'}</div>
              <div>{t('READ_ONLY')}: {mount.readOnly ? t('TRUE') : t('FALSE')}</div>
              <div>{t('SHARED')}: {mount.shared ? t('TRUE') : t('FALSE')}</div>
            </div>
          ))}
        </StatusItem>
      )}
    </Card>
    </>
  );
};

export default ResourceStatus; 