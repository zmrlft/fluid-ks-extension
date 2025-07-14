/*
 * Dataset Metadata component
 */

import React from 'react';
import { useCacheStore as useStore } from '@ks-console/shared';
import { MetaData } from '@ks-console/shared';
import { Loading } from '@kubed/components';

const Metadata = () => {
  const [props] = useStore('DatasetDetailProps');
  const { detail, isLoading } = props;
  console.log(detail);
  console.log(isLoading);

  return isLoading ? <Loading className="page-loading" /> : <MetaData detail={detail} />;
};

export default Metadata; 