import React from 'react';
import ReactDOM from 'react-dom/client';
import { AssistantPage } from './pages/AssistantPage';
import './styles/variables.css';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AssistantPage />
  </React.StrictMode>
);

