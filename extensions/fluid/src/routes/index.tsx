import React from 'react';
import App from '../App';
import DatasetList from '../pages/datasets/list';

export default [
  {
    path: '/fluid',
    element: <App />,
  },
  {
    path: '/fluid/datasets',
    element: <DatasetList />,
  },
];
