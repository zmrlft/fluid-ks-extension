import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { get, debounce } from 'lodash';
import { Button, Card, Banner, Select, Empty, Checkbox } from '@kubed/components';
import { DataTable, TableRef, StatusIndicator } from '@ks-console/shared';
import { useNavigate, useParams } from 'react-router-dom';
import { DownloadDuotone } from '@kubed/icons';
import { transformRequestParams } from '../../../utils';
import { deleteResource, handleBatchResourceDelete } from '../../../utils/deleteResource';

import { getApiPath, getWebSocketUrl, request, getCurrentClusterFromUrl } from '../../../utils/request';
import CreateDataloadModal from '../components/CreateDataloadModal';
import { getStatusIndicatorType } from '../../../utils/getStatusIndicatorType';

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

// 根据CRD定义更新DataLoad类型
interface DataLoad {
  metadata: {
    name: string;
    namespace: string;
    creationTimestamp: string;
    uid: string;
  };
  spec: {
    dataset: {
      name: string;
      namespace?: string;
    };
    target?: Array<{
      path: string;
      replicas?: number;
    }>;
    loadMetadata?: boolean;
    policy?: string;
  };
  status: {
    phase: string;
    duration: string;
    conditions: Array<{
      type: string;
      status: string;
      reason: string;
      message: string;
      lastProbeTime: string;
      lastTransitionTime: string;
    }>;
  };
}

// 格式化数据
const formatDataLoad = (item: Record<string, any>): DataLoad => {
  const dataload = {
    ...item,
    metadata: item.metadata || {},
    spec: item.spec || { 
      dataset: { name: '-' },
    },
    status: item.status || { 
      phase: '-', 
      duration: '-',
      conditions: []
    }
  };
  
  return dataload;
};

const DataLoadList: React.FC = () => {
  const [namespace, setNamespace] = useState<string>('');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [selectedDataLoads, setSelectedDataLoads] = useState<DataLoad[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [currentPageData, setCurrentPageData] = useState<DataLoad[]>([]);
  const [previousDataLength, setPreviousDataLength] = useState<number>(0);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const params: Record<string, any> = useParams();
  const navigate = useNavigate();
  const tableRef = useRef<TableRef<DataLoad>>(null);

  // 从URL参数获取集群信息
  const currentCluster = params.cluster || 'host';

  // 当命名空间变化时，清空选择状态和当前页面数据
  useEffect(() => {
    setSelectedDataLoads([]);
    setCurrentPageData([]);
  }, [namespace]);

  // 监听数据变化，当数据加载任务数量发生变化时清空选择状态
  const handleDataChange = (newData: DataLoad[]) => {
    console.log("=== handleDataChange 被调用 ===");
    console.log("数据变化检测:", {
      previousLength: previousDataLength,
      newLength: newData?.length || 0,
      newData: newData
    });

    if (newData && previousDataLength > 0 && newData.length !== previousDataLength) {
      console.log("检测到数据加载任务数量变化，清空选择状态");
      setSelectedDataLoads([]);
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
  }, 3000);

  // 自定义WebSocket实现来替代DataTable的watchOptions
  useEffect(() => {
    const wsPath = namespace
      ? `/apis/data.fluid.io/v1alpha1/watch/namespaces/${namespace}/dataloads?watch=true`
      : `/apis/data.fluid.io/v1alpha1/watch/dataloads?watch=true`;
    const wsUrl = getWebSocketUrl(wsPath);

    console.log("=== 启动自定义WebSocket监听 ===");
    console.log("WebSocket URL:", wsUrl);

    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;
    let pollingInterval: NodeJS.Timeout | undefined;
    let reconnectCount = 0;
    const maxReconnectAttempts = 5;
    let isComponentUnmounting = false; // 添加标志变量跟踪组件卸载状态
    let connectionStartTime = 0; // 记录连接建立的时间戳
    const INITIAL_EVENTS_WINDOW = 2000; // 连接后2秒内的ADDED事件视为初始状态，单位毫秒

    const connect = () => {
      try {
        console.log("连接WebSocket:", wsUrl);

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("=== WebSocket连接成功 ===");
          setWsConnected(true);
          reconnectCount = 0; // 重置重连计数
          connectionStartTime = Date.now(); // 记录连接建立时间

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
              // 跳过连接建立初期的ADDED事件，因为它们是过时的初始状态
              if (data.type === 'ADDED' && connectionStartTime > 0) {
                const timeSinceConnection = Date.now() - connectionStartTime;
                if (timeSinceConnection < INITIAL_EVENTS_WINDOW) {
                  console.log(`=== 跳过连接初期的ADDED事件 (连接后${timeSinceConnection}ms)，避免不必要的刷新 ===`);
                  return;
                }
              }

              console.log("=== 检测到数据变化，准备防抖刷新 ===");

              // 清空选择状态（特别是删除事件）
              if (data.type === 'DELETED') {
                console.log("检测到删除事件，清空选择状态");
                setSelectedDataLoads([]);
              }

              // 使用防抖函数刷新表格，1000ms内多次调用只会执行最后一次
              debouncedRefresh();
            }
          } catch (e) {
            console.error("解析WebSocket消息失败:", e);
          }
        };

        ws.onclose = (event) => {
          console.log("=== WebSocket连接关闭 ===", event.code, event.reason || '无reason', ws?.url);
          setWsConnected(false);

          // 检查是否是我们主动关闭的
          const isManualClose = isComponentUnmounting;

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
                debouncedRefresh();
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
            debouncedRefresh();
        }, 15000);
      }
    };

    // 启动连接
    connect();

    return () => {
      console.log("=== 清理WebSocket连接和轮询 ===", ws?.url);
      isComponentUnmounting = true;
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
  }, [namespace, currentCluster]);

  // 监听集群切换，刷新数据表格
  // const isFirstClusterEffect = useRef(true);
  // useEffect(() => {
  //   if (isFirstClusterEffect.current) {
  //     isFirstClusterEffect.current = false;
  //     return;
  //   }
  //   if (tableRef.current) {
  //     console.log('集群切换，刷新DataLoad数据表格:', currentCluster);
  //     debouncedRefresh();
  //   }
  // }, [currentCluster]);

  // 获取所有命名空间
  useEffect(() => {
    const fetchNamespaces = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await request('/api/v1/namespaces');

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
  }, [currentCluster]); // 添加currentCluster依赖，集群切换时重新获取命名空间

  // 处理命名空间变更
  const handleNamespaceChange = (value: string) => {
    setNamespace(value);
  };

  // 点击名称跳转到详情页的函数
  const handleNameClick = (name: string, ns: string) => {
    const currentCluster = getCurrentClusterFromUrl();
    const url = `/fluid/${currentCluster}/${ns}/dataloads/${name}/resource-status`;
    navigate(url);
  };
  
  // 创建数据加载任务按钮点击处理
  const handleCreateDataLoad = () => {
    setCreateModalVisible(true);
  };

  // 处理单个数据加载任务选择
  const handleSelectDataLoad = (dataload: DataLoad, checked: boolean) => {
    if (checked) {
      setSelectedDataLoads(prev => [...prev, dataload]);
    } else {
      const dataloadUid = get(dataload, 'metadata.uid', '');
      setSelectedDataLoads(prev => prev.filter(item => get(item, 'metadata.uid', '') !== dataloadUid));
    }
  };

  // 处理全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      // 取消全选
      setSelectedDataLoads([]);
    } else {
      // 全选：选择当前页面的所有数据加载任务
      setSelectedDataLoads([...currentPageData]);
    }
  };



  // 检查全选状态
  const isAllSelected = currentPageData.length > 0 && selectedDataLoads.length === currentPageData.length;
  const isIndeterminate = selectedDataLoads.length > 0 && selectedDataLoads.length < currentPageData.length;

  // 批量删除数据加载任务（使用通用删除函数）
  const handleBatchDelete = async () => {
    if (selectedDataLoads.length === 0) {
      return;
    }

    setIsDeleting(true);
    try {
      const resources = selectedDataLoads.map(dataload => ({
        name: get(dataload, 'metadata.name', ''),
        namespace: get(dataload, 'metadata.namespace', '')
      }));

      await handleBatchResourceDelete(resources, {
        resourceType: 'dataload',
        onSuccess: () => {
          setSelectedDataLoads([]);
          // 可以在这里添加刷新逻辑
        }
      });
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
      render: (_: any, record: DataLoad) => {
        const dataloadUid = get(record, 'metadata.uid', '');
        const isSelected = selectedDataLoads.some(item => get(item, 'metadata.uid', '') === dataloadUid);
        return (
          <Checkbox
            checked={isSelected}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSelectDataLoad(record, e.target.checked)}
          />
        );
      },
    },
    {
      title: t('NAME'),
      field: 'metadata.name',
      width: '15%',
      searchable: true,
      render: (value: any, record: DataLoad) => (
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
      // render: (value: any, record: DataLoad) => <span>{get(record, 'metadata.namespace', '-')}</span>,
    },
    {
      title: t('DATASET'),
      field: 'spec.dataset.name',
      width: '15%',
      canHide: true,
      render: (value: any, record: DataLoad) => <span>{get(record, 'spec.dataset.name', '-')}</span>,
    },
    {
      title: t('STATUS'),
      field: 'status.phase',
      width: '10%',
      canHide: true,
      searchable: true,
      render: (value: any, record: DataLoad) => <span>{
        <StatusIndicator type={getStatusIndicatorType(value)} motion={false}>
            {value || '-'}
        </StatusIndicator>
      }</span>,
    },
    {
      title: t('POLICY'),
      field: 'spec.policy',
      width: '10%',
      canHide: true,
      render: (value: any, record: DataLoad) => <span>{get(record, 'spec.policy', 'Once')}</span>,
    },
    {
      title: t('LOAD_METADATA'),
      field: 'spec.loadMetadata',
      width: '10%',
      canHide: true,
      render: (value: any, record: DataLoad) => <span>{get(record, 'spec.loadMetadata', false) ? t('TRUE') : t('FALSE')}</span>,
    },
    {
      title: t('DURATION'),
      field: 'status.duration',
      width: '10%',
      canHide: true,
      sortable: true,
      render: (value: any, record: DataLoad) => <span>{get(record, 'status.duration', '-')}</span>,
    },
    {
      title: t('CREATION_TIME'),
      field: 'metadata.creationTimestamp',
      width: '15%',
      sortable: true,
      canHide: true,
      render: (value: any, record: DataLoad) => <span>{get(record, 'metadata.creationTimestamp', '-')}</span>,
    },
  ] as any;

  return (
    <div>
      <Banner
        icon={<DownloadDuotone/>}
        title={t('DATALOADS')}
        description={t('DATALOADS_DESC')}
        className="mb12"
      />

      {/* 连接状态指示器 */}
      <StatusIndicator type={wsConnected ? 'success' : 'warning'} motion={true}>
        {wsConnected ? '✓ WebSocket实时监控已连接' : '⚠️ 使用轮询模式（每15秒刷新）'}
      </StatusIndicator>

      <StyledCard>
        {error ? (
          <Empty 
            icon="warning" 
            title={t('FETCH_ERROR_TITLE')} 
            description={error} 
            action={<Button onClick={debouncedRefresh}>{t('RETRY')}</Button>}
          />
        ) : (
          <DataTable
            ref={tableRef}
            rowKey="metadata.uid"
            tableName="dataload-list"
            columns={columns}
            url={getApiPath(namespace ? `/kapis/data.fluid.io/v1alpha1/namespaces/${namespace}/dataloads` : '/kapis/data.fluid.io/v1alpha1/dataloads')}
            format={formatDataLoad}
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
                {selectedDataLoads.length > 0 && (
                  <Button
                    color="error"
                    onClick={handleBatchDelete}
                    loading={isDeleting}
                    style={{ marginRight: '8px' }}
                  >
                    {t('DELETE')} ({selectedDataLoads.length})
                  </Button>
                )}
                <Button onClick={handleCreateDataLoad}>
                  {t('CREATE_DATALOAD')}
                </Button>
              </div>
            }
          />
        )}
      </StyledCard>

      <CreateDataloadModal
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={() => {
          setCreateModalVisible(false);
          // 刷新表格数据
          if (tableRef.current) {
            debouncedRefresh();
          }
        }}
      />


    </div>
  );
};

export default DataLoadList; 