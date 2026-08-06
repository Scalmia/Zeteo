import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { MockHarness } from './mock/MockHarness';
import './styles/tokens.css';

// URL에 ?mock= 이 붙어 있으면 개발용 하네스, 아니면 실제 앱을 띄운다.
// 파트 C는 서버 없이 화면을 보고, 파트 D는 App.tsx 를 그대로 개발할 수 있다.
// 서로의 파일을 고칠 필요가 없다.
const useMock = new URLSearchParams(location.search).has('mock');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>{useMock ? <MockHarness /> : <App />}</ErrorBoundary>
  </StrictMode>,
);
