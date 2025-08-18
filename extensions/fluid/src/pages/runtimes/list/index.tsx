import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { get, debounce } from 'lodash';
import { Button, Card, Banner, Select, Empty } from '@kubed/components';
import { DataTable, TableRef, StatusIndicator } from '@ks-console/shared';
import { useNavigate, useParams } from 'react-router-dom';
import { RocketDuotone } from '@kubed/icons';
import { runtimeTypeList, RuntimeTypeMeta } from '../runtimeMap';
import { transformRequestParams } from '../../../utils';

import { getApiPath, getWebSocketUrl, request } from '../../../utils/request';

// 声明全局 t 函数（国际化）
declare const t: (key: string) => string;

const StyledCard = styled(Card)`
  margin-bottom: 12px;
`;

const ToolbarWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  margin-right: 20px;
`;

// Runtime 数据项接口
interface RuntimeItem {
  name: string;
  namespace: string;
  type: string; // runtime 类型，如 Alluxio、EFC 等
  masterReplicas: string | number;
  workerReplicas: string | number;
  creationTimestamp: string;
  masterPhase: string;
  workerPhase: string;
  fusePhase: string;
  raw: any; // 原始数据
  metadata: {
    name: string;
    namespace: string;
    uid: string;
  };
}

// Runtime 列表页组件
const RuntimeList: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ cluster: string }>();
  const [namespace, setNamespace] = useState<string>('');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 从URL参数获取集群信息
  const currentCluster = params.cluster || 'host';
  const [currentRuntimeType, setCurrentRuntimeType] = useState<number>(0); // 当前选择的 Runtime 类型索引
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const tableRef = useRef<TableRef<any>>(null);
  
  // 创建防抖的刷新函数，1000ms内最多执行一次
  const debouncedRefresh = debounce(() => {
    console.log("=== 执行防抖刷新 ===");
    if (tableRef.current) {
      tableRef.current.refetch();
    }
  }, 1000);

  // 自定义WebSocket实现来监控当前选中的运行时类型
  useEffect(() => {
    const currentRuntime = runtimeTypeList[currentRuntimeType];
    const wsPath = namespace
      ? `/apis/data.fluid.io/v1alpha1/watch/namespaces/${namespace}/${currentRuntime.plural}?watch=true`
      : `/apis/data.fluid.io/v1alpha1/watch/${currentRuntime.plural}?watch=true`;
    const wsUrl = getWebSocketUrl(wsPath);

    console.log(`=== 启动${currentRuntime.displayName} WebSocket监听 ===`);
    console.log("WebSocket URL:", wsUrl);

    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;
    let pollingInterval: NodeJS.Timeout;
    let reconnectCount = 0;
    const maxReconnectAttempts = 5;
    let isComponentUnmounting = false; // 添加标志变量跟踪组件卸载状态

    const connect = () => {
      try {
        console.log("连接WebSocket:", wsUrl);

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log(`=== ${currentRuntime.displayName} WebSocket连接成功 ===`);
          setWsConnected(true);
          reconnectCount = 0; // 重置重连计数

          // WebSocket连接成功，停止轮询
          if (pollingInterval) {
            console.log("WebSocket连接成功，停止轮询");
            clearInterval(pollingInterval);
          }
        };

        ws.onmessage = (event) => {
          console.log(`=== ${currentRuntime.displayName} WebSocket收到消息 ===`);
          try {
            const data = JSON.parse(event.data);
            console.log("消息类型:", data.type);
            console.log("对象名称:", data.object?.metadata?.name);

            // 处理不同类型的事件
            if (['ADDED', 'DELETED', 'MODIFIED'].includes(data.type)) {
              console.log("=== 检测到运行时数据变化，准备防抖刷新 ===");
              debouncedRefresh();
            }
          } catch (e) {
            console.error("解析WebSocket消息失败:", e);
          }
        };

        ws.onclose = (event) => {
          console.log(`=== ${currentRuntime.displayName} WebSocket连接关闭 ===`, event.code, event.reason || '无reason', ws?.url);
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
          console.error(`=== ${currentRuntime.displayName} WebSocket错误 ===`, error);
          setWsConnected(false);
        };
      } catch (error) {
        console.error(`=== 创建${currentRuntime.displayName} WebSocket失败 ===`, error);
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
      console.log(`=== 清理${currentRuntime.displayName} WebSocket连接和轮询 ===`, ws?.url);
      isComponentUnmounting = true;

      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (pollingInterval) {
        console.log("正在清理轮询定时器");
        clearInterval(pollingInterval);
      }
      if (ws) {
        ws.close(1000, 'Component unmounting');
      }
      // 取消防抖函数的待执行任务
      debouncedRefresh.cancel();
      setWsConnected(false);
    };
  }, [namespace, currentRuntimeType, currentCluster]);

  // 监听集群切换，刷新数据表格
  // const isFirstClusterEffect = useRef(true);
  // useEffect(() => {
  //   if (isFirstClusterEffect.current) {
  //     isFirstClusterEffect.current = false;
  //     return;
  //   }
  //   if (tableRef.current) {
  //     console.log('集群切换，刷新运行时数据表格:', currentCluster);
  //     debouncedRefresh();
  //   }
  // }, [currentCluster]);

  // 获取所有 namespace
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
          const namespaceNames = data.items.map((item: any) => item.metadata.name);
          setNamespaces(namespaceNames);
        }
      } catch (error) {
        console.error('Failed to fetch namespaces:', error);
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoading(false);
      }
    };

    fetchNamespaces();
  }, [currentCluster]); // 添加currentCluster依赖，集群切换时重新获取命名空间

  // 处理 namespace 变更
  const handleNamespaceChange = (value: string) => {
    setNamespace(value);
    debouncedRefresh();
  };

  // 处理 Runtime 类型切换
  const handleRuntimeTypeChange = (index: number) => {
    setCurrentRuntimeType(index);
      debouncedRefresh();
  };

  // 点击名称跳转详情页
  const handleNameClick = (name: string, ns: string) => {
    const clusterName = params.cluster || 'host';
    const url = `/fluid/${clusterName}/${ns}/runtimes/${name}/resource-status`;
    navigate(url);
  };

  // 格式化 Runtime 数据
  const formatRuntime = (item: any): RuntimeItem => {
    const typeMeta = runtimeTypeList[currentRuntimeType];
    return {
      name: get(item, 'metadata.name', ''),
      namespace: get(item, 'metadata.namespace', ''),
      type: typeMeta.displayName,
      masterReplicas: get(item, 'spec.master.replicas', get(item, 'spec.replicas', '-')),
      workerReplicas: get(item, 'spec.worker.replicas', get(item, 'spec.replicas', '-')),
      creationTimestamp: get(item, 'metadata.creationTimestamp', ''),
      masterPhase: get(item, 'status.masterPhase', '-'),
      workerPhase: get(item, 'status.workerPhase', '-'),
      fusePhase: get(item, 'status.fusePhase', '-'),
      raw: item,
      metadata: {
        name: get(item, 'metadata.name', ''),
        namespace: get(item, 'metadata.namespace', ''),
        uid: get(item, 'metadata.uid', `${get(item, 'metadata.namespace', '')}-${get(item, 'metadata.name', '')}-${typeMeta.kind}`),
      }
    };
  };

  // 表格列定义
  const columns = [
    {
      title: t('NAME'),
      field: 'name',
      width: '15%',
      searchable: true,
      render: (value: string, record: RuntimeItem) => (
        <a
          onClick={(e) => {
            e.preventDefault();
            handleNameClick(record.name, record.namespace);
          }}
          href="#"
        >
          {record.name}
        </a>
      ),
    },
    {
      title: t('NAMESPACE'),
      field: 'namespace',
      width: '12%',
      canHide: true,
    },
    {
      title: t('TYPE'),
      field: 'type',
      width: '10%',
      canHide: true,
    },
    {
      title: 'Master Replicas',
      field: 'masterReplicas',
      width: '12%',
      canHide: true,
    },
    {
      title: 'Worker Replicas',
      field: 'workerReplicas',
      width: '12%',
      canHide: true,
    },
    {
      title: 'MASTER PHASE',
      field: 'masterPhase',
      width: '13%',
      canHide: true,
    },
    {
      title: 'WORKER PHASE',
      field: 'workerPhase',
      width: '13%',
      canHide: true,
    },
    {
      title: 'FUSE PHASE',
      field: 'fusePhase',
      width: '13%',
      canHide: true,
    },
    {
      title: t('CREATION_TIME'),
      field: 'creationTimestamp',
      width: '15%',
      canHide: true,
      sortable: true,
    },
  ] as any;

  // 获取 API 路径，添加集群前缀
  const basePath = namespace
    ? runtimeTypeList[currentRuntimeType].getApiPath(namespace)
    : runtimeTypeList[currentRuntimeType].getApiPath();
  const apiPath = getApiPath(basePath);

  return (
    <div>
      <Banner
        icon={<RocketDuotone/>}
        title={t('RUNTIMES')}
        description={t('RUNTIMES_DESC')}
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
            tableName="runtimes-list"
            columns={columns}
            url={apiPath}
            format={formatRuntime}
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
                <Select
                  value={currentRuntimeType}
                  onChange={handleRuntimeTypeChange}
                  placeholder={t('TYPE')}
                  style={{ width: 150 }}
                  disabled={isLoading}
                >
                  {runtimeTypeList.map((type, index) => (
                    <Select.Option key={type.kind} value={index}>
                      {type.displayName}
                    </Select.Option>
                  ))}
                </Select>
                
              </ToolbarWrapper>
            }
          />
        )}
      </StyledCard>
    </div>
  );
};

export default RuntimeList;