/*
 * Dataset Resource Status component
 */

import React, { useMemo } from 'react';
import { useCacheStore as useStore } from '@ks-console/shared';
import { Card } from '@kubed/components';
import { get } from 'lodash';
import styled from 'styled-components';

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

const CardWrapper = styled.div`
  margin-bottom: 12px;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 12px;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (max-width: 576px) {
    grid-template-columns: 1fr;
  }
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
`;

const InfoLabel = styled.div`
  font-weight: 600;
  color: #242e42;
  margin-bottom: 4px;
  font-size: 12px;
`;

const InfoValue = styled.div`
  color: #242e42;
  font-size: 14px;
`;

const ProgressWrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
`;

const ProgressHeader = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
`;

const ProgressLabel = styled.div`
  font-weight: 600;
  color: #242e42;
  font-size: 12px;
`;

const ProgressValue = styled.div`
  color: #242e42;
  font-size: 12px;
`;

const ProgressBar = styled.div<{ percent: number }>`
  width: 100%;
  height: 6px;
  background-color: #e9e9e9;
  border-radius: 3px;
  overflow: hidden;
  
  &::after {
    content: '';
    display: block;
    width: ${props => `${props.percent}%`};
    height: 100%;
    background-color: #55bc8a;
    border-radius: 3px;
  }
`;

const TopologyTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  
  th, td {
    border: 1px solid #e9e9e9;
    padding: 8px 12px;
    text-align: left;
  }
  
  th {
    background-color: #f5f5f5;
    font-weight: 600;
    font-size: 12px;
    color: #242e42;
  }
  
  td {
    font-size: 14px;
    color: #242e42;
  }
  
  tr:nth-child(even) {
    background-color: #fafafa;
  }
`;

const MountCard = styled.div`
  border: 1px solid #e9e9e9;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 12px;
  background-color: #f9fbfd;
`;

const MountHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e9e9e9;
`;

const MountTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: #242e42;
`;

const MountDetails = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  
  @media (max-width: 576px) {
    grid-template-columns: 1fr;
  }
`;

const MountItem = styled.div`
  display: flex;
`;

const MountLabel = styled.div`
  font-weight: 600;
  color: #79879c;
  margin-right: 8px;
  min-width: 80px;
  font-size: 12px;
`;

const MountValue = styled.div`
  color: #242e42;
  font-size: 12px;
`;

const ResourceStatus = () => {
  const [props] = useStore('DatasetDetailProps');
  const { detail } = props;

  // 解析缓存百分比
  const getCachePercentage = () => {
    const percentage = get(detail, 'status.cacheStates.cachedPercentage', '0%');
    return parseInt(percentage.replace('%', ''), 10) || 0;
  };

  // 备用的拓扑关系表格
  const renderTopologyTable = () => {
    const datasetName = detail.metadata?.name || 'dataset';
    const runtimes = get(detail, 'spec.runtimes', []) as Runtime[];
    const mounts = get(detail, 'spec.mounts', []) as Mount[];

    return (
      <TopologyTable>
        <thead>
          <tr>
            <th>{t('TYPE')}</th>
            <th>{t('NAME')}</th>
            <th>{t('RELATIONSHIP')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Dataset</td>
            <td>{datasetName}</td>
            <td>-</td>
          </tr>
          {mounts.map((mount, index) => (
            <tr key={`mount-${index}`}>
              <td>{t('DATA_SOURCE')}</td>
              <td>{mount.mountPoint}</td>
              <td>{t('CONNECTED_TO')} {datasetName}</td>
            </tr>
          ))}
          {runtimes.map((runtime, index) => (
            <tr key={`runtime-${index}`}>
              <td>Runtime ({runtime.type})</td>
              <td>{runtime.name}</td>
              <td>{t('MANAGED_BY')} {datasetName}</td>
            </tr>
          ))}
          <tr>
            <td>{t('APPLICATION')}</td>
            <td>{t('VARIOUS_PODS')}</td>
            <td>{t('CONSUME')} {datasetName}</td>
          </tr>
        </tbody>
      </TopologyTable>
    );
  };

  return (
    <>
      {/* 基本信息卡片 */}
      <CardWrapper>
        <Card sectionTitle={t('BASIC_INFORMATION')}>
          <InfoGrid>
            <InfoItem>
              <InfoLabel>{t('STATUS')}</InfoLabel>
              <InfoValue>{get(detail, 'status.phase', '-')}</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>{t('TOTAL_FILES')}</InfoLabel>
              <InfoValue>{get(detail, 'status.fileNum', '-')}</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>{t('UFS_TOTAL')}</InfoLabel>
              <InfoValue>{get(detail, 'status.ufsTotal', '-')}</InfoValue>
            </InfoItem>
          </InfoGrid>
        </Card>
      </CardWrapper>
      
      {/* 缓存状态卡片 */}
      <CardWrapper>
        <Card sectionTitle={t('CACHE_STATUS')}>
          <InfoGrid>
            <InfoItem>
              <InfoLabel>{t('CACHE_CAPACITY')}</InfoLabel>
              <InfoValue>{get(detail, 'status.cacheStates.cacheCapacity', '-')}</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>{t('CACHE_HIT_RATIO')}</InfoLabel>
              <InfoValue>{get(detail, 'status.cacheStates.cacheHitRatio', '-')}</InfoValue>
            </InfoItem>
          </InfoGrid>
          
          <ProgressWrapper>
            <ProgressHeader>
              <ProgressLabel>{t('CACHED')}</ProgressLabel>
              <ProgressValue>
                {get(detail, 'status.cacheStates.cached', '-')} 
                ({get(detail, 'status.cacheStates.cachedPercentage', '0%')})
              </ProgressValue>
            </ProgressHeader>
            <ProgressBar percent={getCachePercentage()} />
          </ProgressWrapper>
        </Card>
      </CardWrapper>
      
      {/* 数据集拓扑图卡片 */}
      <CardWrapper>
        <Card sectionTitle={t('DATASET_TOPOLOGY')}>
          {renderTopologyTable()}
        </Card>
      </CardWrapper>
      
      {/* 挂载信息卡片 */}
      {detail?.spec?.mounts && detail.spec.mounts.length > 0 && (
        <CardWrapper>
          <Card sectionTitle={t('MOUNT_INFORMATION')}>
            {detail.spec.mounts.map((mount: Mount, index: number) => (
              <MountCard key={index}>
                <MountHeader>
                  <MountTitle>{mount.name || `Mount ${index + 1}`}</MountTitle>
                </MountHeader>
                <MountDetails>
                  <MountItem>
                    <MountLabel>{t('MOUNT_POINT')}</MountLabel>
                    <MountValue>{mount.mountPoint}</MountValue>
                  </MountItem>
                  <MountItem>
                    <MountLabel>{t('PATH')}</MountLabel>
                    <MountValue>{mount.path || '-'}</MountValue>
                  </MountItem>
                  <MountItem>
                    <MountLabel>{t('READ_ONLY')}</MountLabel>
                    <MountValue>{mount.readOnly ? t('TRUE') : t('FALSE')}</MountValue>
                  </MountItem>
                  <MountItem>
                    <MountLabel>{t('SHARED')}</MountLabel>
                    <MountValue>{mount.shared ? t('TRUE') : t('FALSE')}</MountValue>
                  </MountItem>
                </MountDetails>
              </MountCard>
            ))}
          </Card>
        </CardWrapper>
      )}
    </>
  );
};

export default ResourceStatus; 