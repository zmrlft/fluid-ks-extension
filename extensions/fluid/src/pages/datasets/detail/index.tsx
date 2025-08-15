/*
 * Dataset detail page component
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loading, Button } from '@kubed/components';
import { useCacheStore as useStore } from '@ks-console/shared';
import { DetailPagee } from '@ks-console/shared';
import { get } from 'lodash';
import { Book2Duotone } from '@kubed/icons';
import { useClusterStore } from '../../../stores/cluster';
import { request } from '../../../utils/request';

// 全局t函数声明
declare const t: (key: string, options?: any) => string;

// 根据CRD定义更新Dataset类型
interface Dataset {
  metadata: {
    name: string;
    namespace: string;
    creationTimestamp: string;
    uid: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
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

const DatasetDetail: React.FC = () => {
  const module = 'datasets';
  const authKey = module;
  const { cluster, namespace, name } = useParams<{ cluster: string; namespace: string; name: string }>();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  // 集群状态管理
  const { setCurrentCluster } = useClusterStore();

  // 存储详情页数据到全局状态
  const [, setDetailProps] = useStore('DatasetDetailProps', {
    module,
    detail: {},
    isLoading: false,
    isError: false,
  });

  // 获取列表页URL
  const listUrl = useMemo(() => {
    return `/fluid/datasets`;
  }, []);

  // 同步URL中的集群参数到状态
  useEffect(() => {
    if (cluster) {
      setCurrentCluster(cluster);
    }
  }, [cluster, setCurrentCluster]);

  // 获取数据集详情
  useEffect(() => {
    const fetchDatasetDetail = async () => {
      try {
        setLoading(true);
        const response = await request(`/apis/data.fluid.io/v1alpha1/namespaces/${namespace}/datasets/${name}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch dataset: ${response.statusText}`);
        }
        const data = await response.json();
        setDataset(data);
        setError(false);
      } catch (error) {
        console.error('Failed to fetch dataset details:', error);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (namespace && name) {
      fetchDatasetDetail();
    }
  }, [namespace, name, cluster]);

  // 更新全局状态
  useEffect(() => {
    setDetailProps({ 
      module, 
      detail: dataset as any, 
      isLoading: loading, 
      isError: error 
    });
  }, [dataset, loading, error]);

  // 定义标签页
  const tabs = useMemo(() => {
    const path = `/fluid/datasets/${cluster}/${namespace}/${name}`;
    return [
      {
        title: t('RESOURCE_STATUS'),
        path: `${path}/resource-status`,
      },
      {
        title: t('METADATA'),
        path: `${path}/metadata`,
      },
      {
        title: t('EVENTS'),
        path: `${path}/events`,
      },
      {
        title: t('YAML'),
        path: `${path}/yaml`,
      },
    ];
  }, [cluster, namespace, name]);

  // 定义操作按钮
  const actions = () => {
    return [
      {
        key: 'edit',
        type: 'control',
        text: t('EDIT'),
        action: 'edit',
        onClick: () => {
          // 编辑功能实现
          console.log('Edit dataset:', name);
          alert(t('EDIT_DATASET_DESC'));
        },
      },
      {
        key: 'delete',
        type: 'danger',
        text: t('DELETE'),
        action: 'delete',
        onClick: () => {
          // 删除功能实现
          console.log('Delete dataset:', name);
          alert(t('DELETE_DATASET_DESC'));
        },
      },
    ];
  };

  // 定义属性
  const attrs = useMemo(() => {
    if (!dataset) return [];
    
    return [
      {
        label: t('STATUS'),
        value: get(dataset, 'status.phase', '-'),
      },
      {
        label: t('NAMESPACE'),
        value: dataset.metadata.namespace,
      },
      {
        label: t('UFS_TOTAL'),
        value: get(dataset, 'status.ufsTotal', '-'),
      },
      {
        label: t('CACHE_CAPACITY'),
        value: get(dataset, 'status.cacheStates.cacheCapacity', '-'),
      },
      {
        label: t('CACHED'),
        value: get(dataset, 'status.cacheStates.cached', '-'),
      },
      {
        label: t('CACHE_PERCENTAGE'),
        value: get(dataset, 'status.cacheStates.cachedPercentage', '-'),
      },
      {
        label: t('CACHE_HIT_RATIO'),
        value: get(dataset, 'status.cacheStates.cacheHitRatio', '-'),
      },
      {
        label: t('TOTAL_FILES'),
        value: get(dataset, 'status.fileNum', '-'),
      },
      {
        label: t('CREATION_TIME'),
        value: dataset.metadata.creationTimestamp,
      },
    ];
  }, [dataset]);

  return (
    <>
      {loading || error ? (
        <Loading className="page-loading" />
      ) : (
        <DetailPagee
          tabs={tabs}
          cardProps={{
            name: dataset?.metadata.name || '',
            authKey,
            params: { namespace, name },
            desc: get(dataset, 'metadata.annotations["kubesphere.io/description"]', ''),
            actions: actions(),
            attrs,
            breadcrumbs: {
              label: t('DATASETS'),
              url: listUrl,
            },
            icon: <Book2Duotone size={24}/>
          }}
        />
      )}
    </>
  );
};

export default DatasetDetail; 