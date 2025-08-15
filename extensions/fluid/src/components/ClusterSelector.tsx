import React, { useEffect } from 'react';
import { Select } from '@kubed/components';
import { useNavigate, useLocation } from 'react-router-dom';
import { useClusterStore } from '../stores/cluster';
import styled from 'styled-components';

// 全局t函数声明
declare const t: (key: string, options?: any) => string;

const ClusterSelectorWrapper = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid #e3e9ef;
  background: #f9fbfd;
  
  .cluster-label {
    font-size: 12px;
    color: #79879c;
    margin-bottom: 8px;
    display: block;
  }
  
  .cluster-select {
    width: 100%;
  }
`;

const ClusterSelector: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentCluster,
    clusters,
    isLoading,
    error,
    setCurrentCluster,
    fetchClusters
  } = useClusterStore();

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  const handleClusterChange = (value: string) => {
    console.log('切换集群:', value);
    setCurrentCluster(value);

    // 更新URL以反映新的集群选择
    const pathParts = location.pathname.split('/');
    if (pathParts.length >= 3 && pathParts[1] === 'fluid') {
      // 新的URL结构分析：
      // 列表页：/fluid/{cluster}/datasets -> ['', 'fluid', 'cluster', 'datasets']
      // 详情页：/fluid/{cluster}/{namespace}/datasets/{name} -> ['', 'fluid', 'cluster', 'namespace', 'datasets', 'name']

      if (pathParts.length >= 6) {
        // 在详情页，重定向到对应的列表页
        const resourceType = pathParts[4]; // datasets, runtimes, dataloads等
        navigate(`/fluid/${value}/${resourceType}`);
      } else if (pathParts.length === 4) {
        // 在列表页，保持当前页面类型
        const currentPage = pathParts[3] || 'datasets';
        navigate(`/fluid/${value}/${currentPage}`);
      } else {
        // 其他情况，默认导航到datasets页面
        navigate(`/fluid/${value}/datasets`);
      }
    } else {
      // 默认导航到datasets页面
      navigate(`/fluid/${value}/datasets`);
    }

    // 显示切换成功提示
    // notify.success(t('CLUSTER_SWITCHED_SUCCESS', { cluster: value }));
  };

  if (error) {
    console.error('集群选择器错误:', error);
    // 如果获取集群列表失败，仍然显示当前集群
    return (
      <ClusterSelectorWrapper>
        <span className="cluster-label">{t('CLUSTER')}</span>
        <Select
          className="cluster-select"
          value={currentCluster}
          disabled
          options={[{
            value: currentCluster,
            label: currentCluster
          }]}
        />
      </ClusterSelectorWrapper>
    );
  }

  return (
    <ClusterSelectorWrapper>
      <span className="cluster-label">{t('CLUSTER')}</span>
      <Select
        className="cluster-select"
        value={currentCluster}
        onChange={handleClusterChange}
        loading={isLoading}
        options={clusters.map(cluster => ({
          value: cluster.name,
          label: cluster.displayName
        }))}
        placeholder={isLoading ? t('LOADING') : t('SELECT_CLUSTER')}
      />
    </ClusterSelectorWrapper>
  );
};

export default ClusterSelector;
