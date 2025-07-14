import React, { useState } from 'react';
import styled from 'styled-components';
import { get } from 'lodash';
import { Button, Card, Banner } from '@kubed/components';
import { DataTable } from '@ks-console/shared';
import { useNavigate } from 'react-router-dom';

// 全局t函数声明
declare const t: (key: string, options?: any) => string;

const StyledCard = styled(Card)`
  margin-bottom: 12px;
`;

// 根据CRD定义更新Dataset类型
interface Dataset {
  metadata: {
    name: string;
    namespace: string;
    creationTimestamp: string;
  };
  spec: {
    mounts: Array<{
      mountPoint: string;
      name: string;
      options?: Record<string, string>;
      path?: string;
      readOnly?: boolean;
      shared?: boolean;
    }>;
    runtimes?: Array<{
      name: string;
      namespace: string;
      type: string;
      category?: string;
      masterReplicas?: number;
    }>;
  };
  status: {
    phase: string;
    conditions: Array<{
      type: string;
      status: string;
      reason: string;
      message: string;
      lastUpdateTime: string;
      lastTransitionTime: string;
    }>;
    cacheStates?: {
      cacheCapacity: string;
      cached: string;
      cachedPercentage: string;
      cacheHitRatio?: string;
    };
    ufsTotal?: string;
    fileNum?: string;
    hcfs?: {
      endpoint: string;
      underlayerFileSystemVersion?: string;
    };
  };
}

// 格式化数据
const formatDataset = (item: Record<string, any>): Dataset => {
  return {
    ...item,
    metadata: item.metadata || {},
    spec: item.spec || { mounts: [] },
    status: item.status || { 
      phase: '-', 
      conditions: [],
      cacheStates: {
        cacheCapacity: '-',
        cached: '-',
        cachedPercentage: '-'
      }
    }
  };
};

const DatasetList: React.FC = () => {
  const [namespace, setNamespace] = useState('default');
  const navigate = useNavigate();

  // 点击名称跳转到详情页的函数
  const handleNameClick = (name: string, ns: string) => {
    navigate(`/fluid/datasets/${ns}/${name}`);
  };

  // 根据CRD定义完善表格列
  const columns = [
    {
      title: t('NAME'),
      dataIndex: 'metadata.name',
      width: '15%',
      render: (name: string, record: Dataset) => (
        <a 
          onClick={(e) => {
            e.preventDefault();
            handleNameClick(name || get(record, 'metadata.name', ''), get(record, 'metadata.namespace', 'default'));
          }}
          href="#"
        >
          {name || get(record, 'metadata.name', '-')}
        </a>
      ),
    },
    {
      title: t('NAMESPACE'),
      dataIndex: 'metadata.namespace',
      width: '10%',
      render: (ns: string, record: Dataset) => <span>{ns || get(record, 'metadata.namespace', '-')}</span>,
    },
    {
      title: t('STATUS'),
      dataIndex: 'status.phase',
      width: '10%',
      render: (phase: string, record: Dataset) => <span>{phase || get(record, 'status.phase', '-')}</span>,
    },
    {
      title: t('DATA_SOURCE'),
      dataIndex: 'spec.mounts',
      width: '20%',
      render: (mounts: Array<{mountPoint: string; name: string}> = [], record: Dataset) => {
        const mountPoint = mounts?.[0]?.mountPoint || 
                          get(record, 'spec.mounts[0].mountPoint') || 
                          '-';
        return <span>{mountPoint}</span>;
      },
    },
    {
      title: t('UFS_TOTAL'),
      dataIndex: 'status.ufsTotal',
      width: '10%',
      render: (total: string, record: Dataset) => (
        <span>{total || get(record, 'status.ufsTotal', '-')}</span>
      ),
    },
    {
      title: t('CACHE_CAPACITY'),
      dataIndex: 'status.cacheStates.cacheCapacity',
      width: '10%',
      render: (capacity: string, record: Dataset) => (
        <span>{capacity || get(record, 'status.cacheStates.cacheCapacity', '-')}</span>
      ),
    },
    {
      title: t('CACHED'),
      dataIndex: 'status.cacheStates.cached',
      width: '10%',
      render: (cached: string, record: Dataset) => (
        <span>{cached || get(record, 'status.cacheStates.cached', '-')}</span>
      ),
    },
    {
      title: t('CACHE_PERCENTAGE'),
      dataIndex: 'status.cacheStates.cachedPercentage',
      width: '10%',
      render: (percentage: string, record: Dataset) => (
        <span>{percentage || get(record, 'status.cacheStates.cachedPercentage', '0%')}</span>
      ),
    },
    {
      title: t('CREATION_TIME'),
      dataIndex: 'metadata.creationTimestamp',
      width: '10%',
      render: (time: string, record: Dataset) => (
        <span>{time || get(record, 'metadata.creationTimestamp', '-')}</span>
      ),
    },
  ] as any;

  return (
    <div>
      <Banner 
        icon="dataset"
        title={t('DATASETS')}
        description={t('DATASET_DESC')}
        className="mb12"
      />
      <StyledCard>
        <DataTable
          rowKey="metadata.name"
          tableName="dataset-list"
          columns={columns}
          // url={`/kapis/resources.kubesphere.io/v1alpha3/namespaces/${namespace}/customresources/data.fluid.io/v1alpha1/datasets`}
          // url={`/apis/data.fluid.io/v1alpha1/namespaces/${namespace}/datasets`}
          url={`/kapis/data.fluid.io/v1alpha1/namespaces/${namespace}/datasets`}
          format={formatDataset}
          placeholder={t('SEARCH_BY_NAME')}
          toolbarRight={
            <Button>
              {t('CREATE_DATASET')}
            </Button>
          }
        />
      </StyledCard>
    </div>
  );
};

export default DatasetList; 