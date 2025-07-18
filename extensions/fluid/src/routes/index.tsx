import React from 'react';
import { Navigate } from 'react-router-dom';
import App from '../App';
import DatasetList from '../pages/datasets/list';
import RuntimeList from '../pages/runtimes/list';
import datasetDetailRoutes from '../pages/datasets/detail/routes';

export default [
  {
    path: '/fluid',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="datasets" replace /> },
      {
        path: 'datasets',
        element: <DatasetList />,
      },
      {
        path: 'runtimes',
        element: <RuntimeList />,
      },
    ]
  },
  ...datasetDetailRoutes,
];
