/*
 * Dataset detail routes
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import DatasetDetail from './index';
import ResourceStatus from './ResourceStatus';
import Metadata from './Metadata';
import Events from './Events';
import YAML from './YAML';

const routes: RouteObject[] = [
  {
    path: '/fluid/datasets/:namespace/:name',
    element: <DatasetDetail />,
    children: [
      {
        index: true,
        element: <Navigate to="resource-status" replace />,
      },
      {
        path: 'resource-status',
        element: <ResourceStatus />,
      },
      {
        path: 'metadata',
        element: <Metadata />,
      },
      {
        path: 'events',
        element: <Events />,
      },
      {
        path: 'yaml',
        element: <YAML />,
      },
    ],
  },
];

export default routes; 