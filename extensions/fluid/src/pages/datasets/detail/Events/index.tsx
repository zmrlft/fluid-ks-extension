/*
 * Dataset Events component
 */

import React from 'react';
import { Events } from '@ks-console/shared';
import { useCacheStore as useStore } from '@ks-console/shared';

const DatasetEvents = () => {
  const [props] = useStore('DatasetDetailProps');
  const { detail, module } = props;
  return <Events detail={detail} module={module} />;
};

export default DatasetEvents; 