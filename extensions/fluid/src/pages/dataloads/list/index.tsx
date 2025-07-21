import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { get } from 'lodash';
import { Button, Card, Banner, Select, Empty } from '@kubed/components';
import { DataTable, TableRef } from '@ks-console/shared';
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
  const params: Record<string, any> = useParams();
  const navigate = useNavigate();
  const tableRef = useRef<TableRef<DataLoad>>(null);

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
            watchOptions={{
              enabled: true,
              module: 'dataloads',
              url: namespace
              ? `/clusters/host/apis/data.fluid.io/v1alpha1/watch/namespaces/${namespace}/dataloads?watch=true`
              : `/clusters/host/apis/data.fluid.io/v1alpha1/watch/dataloads?watch=true`,
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