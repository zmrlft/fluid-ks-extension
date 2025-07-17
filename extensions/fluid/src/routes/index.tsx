import React from 'react';
import App from '../App';
import DatasetList from '../pages/datasets/list';
import RuntimeList from '../pages/runtimes/list';
import datasetDetailRoutes from '../pages/datasets/detail/routes';

export default [
  {
    path: '/fluid',
    element: <App />,
  },
  {
    path: '/fluid/datasets',
    element: <DatasetList />,
  },
  {
    path: '/fluid/runtimes',
    element: <RuntimeList />,
  },
  ...datasetDetailRoutes,
];
