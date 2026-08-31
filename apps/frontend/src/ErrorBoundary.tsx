import { Component, type ErrorInfo, type ReactNode } from "react";
import Button from "./components/Button";
import "./styles/tokens.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * 서버가 GameState 필드를 누락/이상한 값으로 보내면 화면 곳곳(state.players.find 등)에서
 * 렌더링이 그대로 터진다. 이걸 못 잡으면 React가 트리 전체를 걷어내 흰 화면만 남는다 —
 * 여기서 잡아서 최소한의 안내 화면으로 대체한다.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "var(--space-4)",
            background: "var(--color-bg)",
            color: "var(--color-text)",
            padding: "var(--space-4)",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 24, fontWeight: 600, color: "var(--color-accent)", margin: 0 }}>
            문제가 발생했습니다
          </p>
          <p className="text-muted">화면을 표시하는 중 오류가 났습니다. 새로고침해주세요.</p>
          <Button onClick={() => location.reload()}>새로고침</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
