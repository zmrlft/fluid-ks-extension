import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { get } from 'lodash';
import { Button, Card, Banner, Select, Empty } from '@kubed/components';
import { DataTable, TableRef } from '@ks-console/shared';
import { useNavigate, useParams } from 'react-router-dom';
import { getWatchListUrl } from '@ks-console/shared/lib/utils/urlHelper';
import { Book2Duotone } from '@kubed/icons';

// 全局t函数声明
declare const t: (key: string, options?: any) => string;

const StyledCard = styled(Card)`
  margin-bottom: 12px;
`;

const ToolbarWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  margin-right: 20px;
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
  const dataset = {
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
  
  return dataset;
};

// 转换请求参数，将metadata.name转换为name
const transformRequestParams = (params: Record<string, any>) => {
  const { parameters = {}, pageIndex, filters = [], pageSize } = params;
  console.log('转换前的请求参数:', params);
  
  // 从filters中获取搜索关键词
  const keyword = filters[0]?.value;
  
  // 构建查询参数
  const result: Record<string, any> = {
    ...parameters,
    limit: pageSize,
    page: pageIndex + 1,
  };
  
  // 如果有搜索关键词，添加name参数
  if (keyword) {
    result.name = keyword;
    console.log('添加搜索关键词:', keyword);
  }
  
  console.log('转换后的请求参数:', result);
  return result;
};

const DatasetList: React.FC = () => {
  const [namespace, setNamespace] = useState<string>('');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const params: Record<string, any> = useParams();
  const navigate = useNavigate();
  const tableRef = useRef<TableRef<Dataset>>(null);
  console.log(params,'params');

  // 获取所有命名空间
  useEffect(() => {
    const fetchNamespaces = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/v1/namespaces');
        
        if (!response.ok) {
          throw new Error(`${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (data && data.items) {
          const namespaceList = data.items.map((item: any) => item.metadata.name);
          setNamespaces(namespaceList);
        }
      } catch (error) {
        console.error('获取命名空间列表失败:', error);
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoading(false);
      }
    };
    fetchNamespaces();
  }, []);

  // 处理命名空间变更
  const handleNamespaceChange = (value: string) => {
    setNamespace(value);
  };

  // 点击名称跳转到详情页的函数
  const handleNameClick = (name: string, ns: string) => {
    navigate(`/fluid/datasets/${ns}/${name}`);
  };
  
  // 创建数据集按钮点击处理
  const handleCreateDataset = () => {
    // 暂时实现为提示信息
    console.log('创建数据集功能待实现');
    alert(t('CREATE_DATASET_DESC') || '创建数据集功能待实现');
  };

  // 刷新表格数据
  const handleRefresh = () => {
    if (tableRef.current) {
      tableRef.current.refetch();
    }
  };

  // 根据CRD定义完善表格列
  const columns = [
    {
      title: t('NAME'),
      field: 'metadata.name',
      width: '15%',
      searchable: true,
      render: (value: any, record: Dataset) => (
        <a 
          onClick={(e) => {
            e.preventDefault();
            handleNameClick(get(record, 'metadata.name', ''), get(record, 'metadata.namespace', 'default'));
          }}
          href="#"
        >
          {get(record, 'metadata.name', '-')}
        </a>
      ),
    },
    {
      title: t('NAMESPACE'),
      field: 'metadata.namespace',
      width: '10%',
      canHide: true,
      render: (value: any, record: Dataset) => <span>{get(record, 'metadata.namespace', '-')}</span>,
    },
    {
      title: t('STATUS'),
      field: 'status.phase',
      width: '10%',
      canHide: true,
      searchable: true,
      render: (value: any, record: Dataset) => <span>{get(record, 'status.phase', '-')}</span>,
    },
    {
      title: t('DATA_SOURCE'),
      field: 'spec.mounts[0].mountPoint',
      width: '20%',
      canHide: true,
      searchable: true,
      render: (value: any, record: Dataset) => {
        const mountPoint = get(record, 'spec.mounts[0].mountPoint', '-');
        return <span>{mountPoint}</span>;
      },
    },
    {
      title: t('UFS_TOTAL'),
      field: 'status.ufsTotal',
      width: '10%',
      sortable: true,
      canHide: true,
      render: (value: any, record: Dataset) => <span>{get(record, 'status.ufsTotal', '-')}</span>,
    },
    {
      title: t('CACHE_CAPACITY'),
      field: 'status.cacheStates.cacheCapacity',
      width: '10%',
      sortable: true,
      canHide: true,
      render: (value: any, record: Dataset) => <span>{get(record, 'status.cacheStates.cacheCapacity', '-')}</span>,
    },
    {
      title: t('CACHED'),
      field: 'status.cacheStates.cached',
      width: '10%',
      sortable: true,
      canHide: true,
      render: (value: any, record: Dataset) => <span>{get(record, 'status.cacheStates.cached', '-')}</span>,
    },
    {
      title: t('CACHE_PERCENTAGE'),
      field: 'status.cacheStates.cachedPercentage',
      width: '10%',
      sortable: true,
      canHide: true,
      render: (value: any, record: Dataset) => <span>{get(record, 'status.cacheStates.cachedPercentage', '0%')}</span>,
    },
    {
      title: t('CREATION_TIME'),
      field: 'metadata.creationTimestamp',
      width: '10%',
      sortable: true,
      canHide: true,
      render: (value: any, record: Dataset) => <span>{get(record, 'metadata.creationTimestamp', '-')}</span>,
    },
  ] as any;

  return (
    <div>
      <Banner 
        icon={<Book2Duotone />}
        title={t('DATASETS')}
        description={t('DATASET_DESC')}
        className="mb12"
      />
      <StyledCard>
        {error ? (
          <Empty 
            icon="warning" 
            title={t('FETCH_ERROR_TITLE')} 
            description={error} 
            action={<Button onClick={handleRefresh}>{t('RETRY')}</Button>}
          />
        ) : (
          <DataTable
            ref={tableRef}
            rowKey="metadata.uid"
            tableName="dataset-list"
            columns={columns}
            url={namespace ? `/kapis/data.fluid.io/v1alpha1/namespaces/${namespace}/datasets` : '/kapis/data.fluid.io/v1alpha1/datasets'}
            format={formatDataset}
            placeholder={t('SEARCH_BY_NAME')}
            transformRequestParams={transformRequestParams}
            simpleSearch={true}
            watchOptions={{
              enabled: true,
              module: 'datasets',
              url: namespace
              ? `/clusters/host/apis/data.fluid.io/v1alpha1/watch/namespaces/${namespace}/datasets?watch=true`
              : `/clusters/host/apis/data.fluid.io/v1alpha1/watch/datasets?watch=true`,
            }}
            toolbarLeft={
              <ToolbarWrapper>
                <Select
                  value={namespace}
                  onChange={handleNamespaceChange}
                  placeholder={t('SELECT_NAMESPACE')}
                  style={{ width: 200 }}
                  disabled={isLoading}
                >
                  <Select.Option value="">{t('ALL_PROJECTS')}</Select.Option>
                  {namespaces.map(ns => (
                    <Select.Option key={ns} value={ns}>
                      {ns}
                    </Select.Option>
                  ))}
                </Select>
              </ToolbarWrapper>
            }
            toolbarRight={
              <Button onClick={handleCreateDataset} style={{ marginLeft: '16px' }}>
                {t('CREATE_DATASET')}
              </Button>
            }
          />
        )}
      </StyledCard>
    </div>
  );
};

export default DatasetList; 