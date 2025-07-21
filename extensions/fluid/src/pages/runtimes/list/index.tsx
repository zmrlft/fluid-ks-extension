import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { get } from 'lodash';
import { Button, Card, Banner, Select, Empty } from '@kubed/components';
import { DataTable, TableRef } from '@ks-console/shared';
import { useNavigate } from 'react-router-dom';
import { RocketDuotone } from '@kubed/icons';
import { runtimeTypeList, RuntimeTypeMeta } from '../runtimeMap';
import { transformRequestParams } from '../../../utils';

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
  status: string;
  masterReplicas: string | number;
  workerReplicas: string | number;
  creationTimestamp: string;
  cacheCapacity: string;
  cached: string;
  cachedPercentage: string;
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
  const [namespace, setNamespace] = useState<string>('');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentRuntimeType, setCurrentRuntimeType] = useState<number>(0); // 当前选择的 Runtime 类型索引
  const tableRef = useRef<TableRef<any>>(null);
  
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
  
  // 获取所有 namespace
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
  }, []);

  // 处理 namespace 变更
  const handleNamespaceChange = (value: string) => {
    setNamespace(value);
    if (tableRef.current) {
      tableRef.current.refetch();
    }
  };

  // 处理 Runtime 类型切换
  const handleRuntimeTypeChange = (index: number) => {
    setCurrentRuntimeType(index);
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

  // 点击名称跳转详情页（预留）
  const handleNameClick = (name: string, ns: string) => {
    // TODO: 实现跳转详情页
    alert(t('DATASET_NOT_FOUND_DESC'));
  };

  // 格式化 Runtime 数据
  const formatRuntime = (item: any): RuntimeItem => {
    const typeMeta = runtimeTypeList[currentRuntimeType];
    return {
      name: get(item, 'metadata.name', ''),
      namespace: get(item, 'metadata.namespace', ''),
      type: typeMeta.displayName,
      status: get(item, 'status.phase', get(item, 'status.state', '-')),
      masterReplicas: get(item, 'spec.master.replicas', get(item, 'spec.replicas', '-')),
      workerReplicas: get(item, 'spec.worker.replicas', get(item, 'spec.replicas', '-')),
      creationTimestamp: get(item, 'metadata.creationTimestamp', ''),
      cacheCapacity: get(item, 'status.cacheStates.cacheCapacity', 
                      get(item, 'status.cacheCapacity', '-')),
      cached: get(item, 'status.cacheStates.cached', 
              get(item, 'status.cached', '-')),
      cachedPercentage: get(item, 'status.cacheStates.cachedPercentage', 
                        get(item, 'status.cachedPercentage', '0%')),
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
      width: '10%',
      canHide: true,
    },
    {
      title: t('TYPE'),
      field: 'type',
      width: '10%',
      canHide: true,
    },
    {
      title: t('STATUS'),
      field: 'status',
      width: '10%',
      canHide: true,
    },
    {
      title: 'Master Replicas',
      field: 'masterReplicas',
      width: '15%',
      canHide: true,
    },
    {
      title: 'Worker Replicas',
      field: 'workerReplicas',
      width: '15%',
      canHide: true,
    },
    {
      title: t('CREATION_TIME'),
      field: 'creationTimestamp',
      width: '15%',
      canHide: true,
      sortable: true,
    },
    {
      title: t('CACHE_CAPACITY'),
      field: 'cacheCapacity',
      width: '15%',
      canHide: true,
      sortable: true,
    },
    {
      title: t('CACHED'),
      field: 'cached',
      width: '10%',
      canHide: true,
      sortable: true,
    },
    {
      title: t('CACHE_PERCENTAGE'),
      field: 'cachedPercentage',
      width: '10%',
      canHide: true,
      sortable: true,
    },
  ] as any;

  // 获取 API 路径
  const apiPath = namespace 
    ? runtimeTypeList[currentRuntimeType].getApiPath(namespace)
    : runtimeTypeList[currentRuntimeType].getApiPath();

  return (
    <div>
      <Banner
        icon={<RocketDuotone/>}
        title={t('RUNTIMES')}
        description={t('RUNTIMES_DESC')}
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