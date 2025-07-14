import React from 'react';
import App from '../App';
import DatasetList from '../pages/datasets/list';
import DatasetDetail from '../pages/datasets/detail';
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
  ...datasetDetailRoutes,
];
