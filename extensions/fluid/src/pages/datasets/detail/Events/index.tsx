/*
 * Dataset Events component
 */

import React from 'react';
import { Events } from '@ks-console/shared';
import { useCacheStore as useStore } from '@ks-console/shared';
import { get } from 'lodash';

// 手动解析 URL 中的 cluster 参数
const getClusterFromUrl = () => {
  const pathSegments = window.location.pathname.split('/');
  const clusterIndex = pathSegments.indexOf('clusters') + 1;
  return clusterIndex > 0 && clusterIndex < pathSegments.length
    ? pathSegments[clusterIndex]
    : 'host'; // KubeSphere默认集群名
};

// 数据集状态判断
const getDatasetPhase = (item: any) => {
  const deletionTime = get(item, 'metadata.deletionTimestamp');
  if (deletionTime) {
    return 'Terminating';
  }
  return get(item, 'status.phase', 'Unknown');
};

const DatasetEvents = () => {
  const [props] = useStore('DatasetDetailProps');
  const { detail: rawDetail, module } = props;

  console.log('DatasetEvents - 原始detail:', rawDetail);
  console.log('DatasetEvents - module:', module);

  // 如果没有原始数据，显示加载状态
  if (!rawDetail) {
    return <div>Loading dataset details...</div>;
  }

  // 获取集群信息
  const cluster = getClusterFromUrl();

  // 规范化数据，转换为Events组件期望的格式
  const normalizedDetail = {
    // 核心标识字段（Events组件必需）
    uid: get(rawDetail, 'metadata.uid'),
    name: get(rawDetail, 'metadata.name'),
    namespace: get(rawDetail, 'metadata.namespace'),
    cluster: cluster,

    // 状态相关字段
    phase: getDatasetPhase(rawDetail),
    deletionTime: get(rawDetail, 'metadata.deletionTimestamp'),

    // 原始数据引用（组件内部可能依赖）
    _originData: rawDetail,

    // 其他辅助字段
    creationTime: get(rawDetail, 'metadata.creationTimestamp'),
    kind: get(rawDetail, 'kind', 'Dataset'),
    apiVersion: get(rawDetail, 'apiVersion', 'data.fluid.io/v1alpha1'),

    // 保持原有的metadata结构以防某些组件依赖
    metadata: rawDetail.metadata,
  };

  console.log('DatasetEvents - 规范化后的detail:', normalizedDetail);

  return (
      <Events detail={normalizedDetail} module="datasets" />
  );
};

export default DatasetEvents;