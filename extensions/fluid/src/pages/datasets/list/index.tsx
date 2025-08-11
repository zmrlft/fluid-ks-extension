import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { get, debounce } from 'lodash';
import { Button, Card, Banner, Select, Empty, Checkbox, notify } from '@kubed/components';
import { DataTable, TableRef, StatusIndicator } from '@ks-console/shared';
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
  const [previousDataLength, setPreviousDataLength] = useState<number>(0);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const params: Record<string, any> = useParams();
  const navigate = useNavigate();
  const tableRef = useRef<TableRef<Dataset>>(null);
  console.log(params,'params');
  
  // 添加轮询机制，秒刷新一次
  useEffect(() => {
    let intervalId: number;
    
    if (false) {
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

  // 监听数据变化，当数据集数量发生变化时清空选择状态
  const handleDataChange = (newData: Dataset[]) => {
    console.log("=== handleDataChange 被调用 ===");
    console.log("数据变化检测:", {
      previousLength: previousDataLength,
      newLength: newData?.length || 0,
      newData: newData
    });

    if (newData && previousDataLength > 0 && newData.length !== previousDataLength) {
      console.log("检测到数据集数量变化，清空选择状态");
      setSelectedDatasets([]);
    }

    setPreviousDataLength(newData?.length || 0);
    setCurrentPageData(newData || []);
  };



  // 创建防抖的刷新函数，1000ms内最多执行一次
  const debouncedRefresh = debounce(() => {
    console.log("=== 执行防抖刷新 ===");
    if (tableRef.current) {
      tableRef.current.refetch();
    }
  }, 1000);

  // 自定义WebSocket实现来替代DataTable的watchOptions
  useEffect(() => {
    const wsUrl = namespace
      ? `/clusters/host/apis/data.fluid.io/v1alpha1/watch/namespaces/${namespace}/datasets?watch=true`
      : `/clusters/host/apis/data.fluid.io/v1alpha1/watch/datasets?watch=true`;

    console.log("=== 启动自定义WebSocket监听 ===");
    console.log("WebSocket URL:", wsUrl);

    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;
    let pollingInterval: NodeJS.Timeout | undefined;
    let reconnectCount = 0;
    const maxReconnectAttempts = 5;

    const connect = () => {
      try {
        // 构建完整的WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const fullWsUrl = `${protocol}//${window.location.host}${wsUrl}`;
        console.log("连接WebSocket:", fullWsUrl);

        ws = new WebSocket(fullWsUrl);

        ws.onopen = () => {
          console.log("=== WebSocket连接成功 ===");
          setWsConnected(true);
          reconnectCount = 0; // 重置重连计数

          // WebSocket连接成功，停止轮询
          if (pollingInterval) {
            console.log("WebSocket连接成功，停止轮询");
            clearInterval(pollingInterval);
            pollingInterval = undefined;
          }
        };

        ws.onmessage = (event) => {
          console.log("=== WebSocket收到消息 ===");
          try {
            const data = JSON.parse(event.data);
            console.log("消息类型:", data.type);
            console.log("对象名称:", data.object?.metadata?.name);

            // 处理不同类型的事件
            if (['ADDED', 'DELETED', 'MODIFIED'].includes(data.type)) {
              console.log("=== 检测到数据变化，准备防抖刷新 ===");

              // 清空选择状态（特别是删除事件）
              if (data.type === 'DELETED') {
                console.log("检测到删除事件，清空选择状态");
                setSelectedDatasets([]);
              }

              // 使用防抖函数刷新表格，1000ms内多次调用只会执行最后一次
              debouncedRefresh();
            }
          } catch (e) {
            console.error("解析WebSocket消息失败:", e);
          }
        };

        ws.onclose = (event) => {
          console.log("=== WebSocket连接关闭 ===", event.code, event.reason || '无reason');
          setWsConnected(false);

          // 检查是否是我们主动关闭的（通过reason判断）
          const isManualClose = event.reason === 'Component unmounting';

          if (!isManualClose && reconnectCount < maxReconnectAttempts) {
            // 不是手动关闭，尝试重连
            const delay = Math.min(1000 * Math.pow(2, reconnectCount), 10000);
            console.log(`${delay}ms后尝试重连 (${reconnectCount + 1}/${maxReconnectAttempts})`);

            reconnectTimeout = setTimeout(() => {
              reconnectCount++;
              connect();
            }, delay);
          } else if (!isManualClose && reconnectCount >= maxReconnectAttempts) {
            // 重连次数用完，启动轮询保底方案
            console.log("=== WebSocket重连失败，启动15秒轮询保底方案 ===");
            pollingInterval = setInterval(() => {
              console.log("=== 执行轮询刷新 ===");
              if (tableRef.current) {
                tableRef.current.refetch();
              }
            }, 15000);
          } else if (isManualClose) {
            console.log("=== 组件卸载，正常关闭WebSocket ===");
          }
        };

        ws.onerror = (error) => {
          console.error("=== WebSocket错误 ===", error);
          setWsConnected(false);
        };
      } catch (error) {
        console.error("=== 创建WebSocket失败 ===", error);
        setWsConnected(false);

        // WebSocket创建失败，直接启动轮询保底方案
        console.log("=== WebSocket创建失败，启动15秒轮询保底方案 ===");
        pollingInterval = setInterval(() => {
          console.log("=== 执行轮询刷新 ===");
          if (tableRef.current) {
            tableRef.current.refetch();
          }
        }, 15000);
      }
    };

    // 启动连接
    connect();

    return () => {
      console.log("=== 清理WebSocket连接和轮询 ===");
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (ws) {
        ws.close(1000, 'Component unmounting');
      }
      // 取消防抖函数的待执行任务
      debouncedRefresh.cancel();
      setWsConnected(false);
    };
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
    console.log("=== 手动刷新被调用 ===");
    if (tableRef.current) {
      tableRef.current.refetch();
    }
  };

  // 监听tableRef的变化，添加refetch方法的代理
  // useEffect(() => {
  //   if (tableRef.current && tableRef.current.refetch) {
  //     const originalRefetch = tableRef.current.refetch;
  //     tableRef.current.refetch = (...args) => {
  //       console.log("=== DataTable refetch 被调用 ===");
  //       console.log("调用参数:", args);
  //       return originalRefetch.apply(tableRef.current, args);
  //     };
  //   }
  // }, [tableRef.current]);

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

      {/* 连接状态指示器 */}
      {/* <div style={{
        padding: '8px 12px',
        backgroundColor: wsConnected ? '#f6ffed' : '#fff7e6',
        border: `1px solid ${wsConnected ? '#b7eb8f' : '#ffd591'}`,
        borderRadius: '4px',
        marginBottom: '12px',
        fontSize: '12px',
        color: wsConnected ? '#52c41a' : '#fa8c16'
      }}>
        {wsConnected ? '✓ WebSocket实时监控已连接' : '⚠️ 使用轮询模式（每15秒刷新）'}
      </div> */}
      <StatusIndicator type={wsConnected ? 'success' : 'warning'} motion={true}>
        {wsConnected ? '✓ WebSocket实时监控已连接' : '⚠️ 使用轮询模式（每15秒刷新）'}
      </StatusIndicator>


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
            onChangeData={handleDataChange}
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