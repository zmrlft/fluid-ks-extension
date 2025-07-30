import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { get } from 'lodash';
import { Button, Card, Banner, Select, Empty, Checkbox, notify } from '@kubed/components';
import { DataTable, TableRef } from '@ks-console/shared';
import { useNavigate, useParams } from 'react-router-dom';
import { Book2Duotone } from '@kubed/icons';
import { transformRequestParams } from '../../../utils';
import CreateDatasetModal from '../components/CreateDatasetModal';

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

const DatasetList: React.FC = () => {
  const [namespace, setNamespace] = useState<string>('');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [selectedDatasets, setSelectedDatasets] = useState<Dataset[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [currentPageData, setCurrentPageData] = useState<Dataset[]>([]);
  const params: Record<string, any> = useParams();
  const navigate = useNavigate();
  const tableRef = useRef<TableRef<Dataset>>(null);
  console.log(params,'params');
  
  // 添加轮询机制，秒刷新一次
  useEffect(() => {
    let intervalId: number;
    
    if (true) {
      intervalId = window.setInterval(() => {
        console.log('执行数据轮询刷新');
        if (tableRef.current) {
          tableRef.current.refetch();
        }
      }, 15000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [namespace]);

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

  // 当命名空间变化时，清空选择状态和当前页面数据
  useEffect(() => {
    setSelectedDatasets([]);
    setCurrentPageData([]);
  }, [namespace]);

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
    setCreateModalVisible(true);
  };

  // 创建数据集成功处理
  const handleCreateSuccess = () => {
    // 刷新表格数据
    if (tableRef.current) {
      tableRef.current.refetch();
    }
  };

  // 刷新表格数据
  const handleRefresh = () => {
    if (tableRef.current) {
      tableRef.current.refetch();
    }
  };

  // 处理单个数据集选择
  const handleSelectDataset = (dataset: Dataset, checked: boolean) => {
    if (checked) {
      setSelectedDatasets(prev => [...prev, dataset]);
    } else {
      const datasetUid = get(dataset, 'metadata.uid', '');
      setSelectedDatasets(prev => prev.filter(item => get(item, 'metadata.uid', '') !== datasetUid));
    }
  };

  // 处理全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      // 取消全选
      setSelectedDatasets([]);
    } else {
      // 全选：由于无法直接获取表格数据，我们使用一个变通方法
      // 通过 API 获取当前页面的数据集
      fetchCurrentPageDatasets();
    }
  };

  // 获取当前页面的数据集用于全选
  const fetchCurrentPageDatasets = async () => {
    try {
      const url = namespace
        ? `/kapis/data.fluid.io/v1alpha1/namespaces/${namespace}/datasets`
        : '/kapis/data.fluid.io/v1alpha1/datasets';

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data && data.items) {
          const formattedDatasets = data.items.map(formatDataset);
          setCurrentPageData(formattedDatasets);
          setSelectedDatasets(formattedDatasets);
        }
      }
    } catch (error) {
      console.error('获取数据集列表失败:', error);
    }
  };

  // 检查全选状态
  const isAllSelected = currentPageData.length > 0 && selectedDatasets.length === currentPageData.length;
  const isIndeterminate = selectedDatasets.length > 0 && selectedDatasets.length < currentPageData.length;



  // 删除单个数据集
  const deleteDataset = async (name: string, namespace: string) => {
    try {
      const response = await fetch(`/kapis/data.fluid.io/v1alpha1/namespaces/${namespace}/datasets/${name}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`删除失败: ${response.status} ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('删除数据集失败:', error);
      throw error;
    }
  };

  // 批量删除数据集
  const handleBatchDelete = async () => {
    if (selectedDatasets.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `确定要删除选中的 ${selectedDatasets.length} 个数据集吗？此操作不可撤销。删除操作不会立马成功，请等待一会重新刷新表格`
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      // 并行删除所有选中的数据集
      const deletePromises = selectedDatasets.map(dataset =>
        deleteDataset(
          get(dataset, 'metadata.name', ''),
          get(dataset, 'metadata.namespace', '')
        )
      );

      await Promise.all(deletePromises);

      notify.success(`成功删除 ${selectedDatasets.length} 个数据集`);
      setSelectedDatasets([]);
      handleRefresh();
    } catch (error) {
      console.error('批量删除失败:', error);
      notify.error('删除数据集失败，请重试');
    } finally {
      setIsDeleting(false);
    }
  };

  // 根据CRD定义完善表格列
  const columns = [
    {
      title: (
        <Checkbox
          checked={isAllSelected}
          indeterminate={isIndeterminate}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            handleSelectAll(e.target.checked);
          }}
        />
      ),
      field: 'selection',
      width: '50px',
      render: (_: any, record: Dataset) => {
        const datasetUid = get(record, 'metadata.uid', '');
        const isSelected = selectedDatasets.some(item => get(item, 'metadata.uid', '') === datasetUid);
        return (
          <Checkbox
            checked={isSelected}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSelectDataset(record, e.target.checked)}
          />
        );
      },
    },
    {
      title: t('NAME'),
      field: 'metadata.name',
      width: '15%',
      searchable: true,
      render: (_: any, record: Dataset) => (
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
      render: (_: any, record: Dataset) => <span>{get(record, 'metadata.namespace', '-')}</span>,
    },
    {
      title: t('STATUS'),
      field: 'status.phase',
      width: '10%',
      canHide: true,
      searchable: true,
      render: (_: any, record: Dataset) => <span>{get(record, 'status.phase', '-')}</span>,
    },
    {
      title: t('DATA_SOURCE'),
      field: 'spec.mounts[0].mountPoint',
      width: '20%',
      canHide: true,
      searchable: true,
      render: (_: any, record: Dataset) => {
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
      render: (_: any, record: Dataset) => <span>{get(record, 'status.ufsTotal', '-')}</span>,
    },
    {
      title: t('CACHE_CAPACITY'),
      field: 'status.cacheStates.cacheCapacity',
      width: '10%',
      sortable: true,
      canHide: true,
      render: (_: any, record: Dataset) => <span>{get(record, 'status.cacheStates.cacheCapacity', '-')}</span>,
    },
    {
      title: t('CACHED'),
      field: 'status.cacheStates.cached',
      width: '10%',
      sortable: true,
      canHide: true,
      render: (_: any, record: Dataset) => <span>{get(record, 'status.cacheStates.cached', '-')}</span>,
    },
    {
      title: t('CACHE_PERCENTAGE'),
      field: 'status.cacheStates.cachedPercentage',
      width: '10%',
      sortable: true,
      canHide: true,
      render: (_: any, record: Dataset) => <span>{get(record, 'status.cacheStates.cachedPercentage', '0%')}</span>,
    },
    {
      title: t('CREATION_TIME'),
      field: 'metadata.creationTimestamp',
      width: '10%',
      sortable: true,
      canHide: true,
      render: (_: any, record: Dataset) => <span>{get(record, 'metadata.creationTimestamp', '-')}</span>,
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
              onAddedOrDeleted: () => {
                // 当数据变化时，清空选择状态以避免选中已删除的数据集
                setSelectedDatasets([]);
              }
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
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedDatasets.length > 0 && (
                  <Button
                    color="error"
                    onClick={handleBatchDelete}
                    loading={isDeleting}
                    style={{ marginRight: '8px' }}
                  >
                    {t('DELETE')} ({selectedDatasets.length})
                  </Button>
                )}
                <Button onClick={handleCreateDataset}>
                  {t('CREATE_DATASET')}
                </Button>
              </div>
            }
          />
        )}
      </StyledCard>

      <CreateDatasetModal
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
};

export default DatasetList; 