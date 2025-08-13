import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { get, debounce } from 'lodash';
import { Button, Card, Banner, Select, Empty } from '@kubed/components';
import { DataTable, TableRef, StatusIndicator } from '@ks-console/shared';
import { useNavigate, useParams } from 'react-router-dom';
import { DownloadDuotone } from '@kubed/icons';
import { transformRequestParams } from '../../../utils';

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
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const params: Record<string, any> = useParams();
  const navigate = useNavigate();
  const tableRef = useRef<TableRef<DataLoad>>(null);

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
      ? `/clusters/host/apis/data.fluid.io/v1alpha1/watch/namespaces/${namespace}/dataloads?watch=true`
      : `/clusters/host/apis/data.fluid.io/v1alpha1/watch/dataloads?watch=true`;

    console.log("=== 启动自定义WebSocket监听 ===");
    console.log("WebSocket URL:", wsUrl);

    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;
    let pollingInterval: NodeJS.Timeout | undefined;
    let reconnectCount = 0;
    const maxReconnectAttempts = 5;
    let isComponentUnmounting = false; // 添加标志变量跟踪组件卸载状态

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

  // 处理命名空间变更
  const handleNamespaceChange = (value: string) => {
    setNamespace(value);
  };

  // 点击名称跳转到详情页的函数（预留功能，实际暂不实现）
  const handleNameClick = (name: string, ns: string) => {
    // 预留详情页跳转功能
    alert(`暂未实现详情页：/fluid/dataloads/${ns}/${name}`);
  };
  
  // 创建数据加载任务按钮点击处理
  const handleCreateDataLoad = () => {
    // 暂时实现为提示信息
    alert('创建数据加载任务功能待实现');
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
      render: (value: any, record: DataLoad) => <span>{get(record, 'metadata.namespace', '-')}</span>,
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
      render: (value: any, record: DataLoad) => <span>{get(record, 'status.phase', '-')}</span>,
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
            action={<Button onClick={handleRefresh}>{t('RETRY')}</Button>}
          />
        ) : (
          <DataTable
            ref={tableRef}
            rowKey="metadata.uid"
            tableName="dataload-list"
            columns={columns}
            url={namespace ? `/kapis/data.fluid.io/v1alpha1/namespaces/${namespace}/dataloads` : '/kapis/data.fluid.io/v1alpha1/dataloads'}
            format={formatDataLoad}
            placeholder={t('SEARCH_BY_NAME')}
            transformRequestParams={transformRequestParams}
            simpleSearch={true}
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
              <Button onClick={handleCreateDataLoad} style={{ marginLeft: '16px' }}>
                {t('CREATE_DATALOAD')}
              </Button>
            }
          />
        )}
      </StyledCard>
    </div>
  );
};

export default DataLoadList; 