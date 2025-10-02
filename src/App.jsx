import React from 'react';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import SupportAssistantApp from './SupportAssistantApp.jsx';

export default function App() {
  return (
    <ErrorBoundary>
      <SupportAssistantApp />
    </ErrorBoundary>
  );
}
