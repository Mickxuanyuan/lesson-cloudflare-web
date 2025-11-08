import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const DEFAULT_GRAPHQL_ENDPOINT = 'https://cloudflare-ai-worker.303062086.workers.dev/api/graphql';
const GRAPHQL_ENDPOINT =
  (process.env.REACT_APP_GRAPHQL_ENDPOINT &&
    process.env.REACT_APP_GRAPHQL_ENDPOINT.trim()) ||
  DEFAULT_GRAPHQL_ENDPOINT;

const SEND_MESSAGE_MUTATION = `
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      message {
        id
        role
        content
      }
    }
  }
`;

const introMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    '你好，我是你的 DeFi 技术助教。把你想和 DeepSeek 讨论的内容告诉我，我会通过 GraphQL 帮你转述。',
};

function App() {
  const [messages, setMessages] = useState([introMessage]);
  const [pendingMessage, setPendingMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  const endpointLabel = useMemo(() => {
    try {
      const url = new URL(GRAPHQL_ENDPOINT);
      return `${url.origin}${url.pathname}`;
    } catch {
      return GRAPHQL_ENDPOINT;
    }
  }, []);

  useEffect(() => {
    const node = bottomRef.current;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending]);

  const createLocalId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const callChatMutation = useCallback(async (text) => {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: SEND_MESSAGE_MUTATION,
        variables: {
          input: {
            message: text,
          },
        },
      }),
    });

    const rawBody = await response.text();
    let payload;
    try {
      payload = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(
        payload?.errors?.[0]?.message ||
          payload?.message ||
          `GraphQL 请求失败（${response.status}）`
      );
    }

    if (payload?.errors?.length) {
      throw new Error(payload.errors[0]?.message || 'GraphQL 返回错误');
    }

    const assistantMessage = payload?.data?.sendMessage?.message;
    if (!assistantMessage) {
      throw new Error('接口没有返回 AI 回复消息。');
    }
    return assistantMessage;
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = pendingMessage.trim();
    if (!trimmed || isSending) {
      return;
    }

    const userMessage = {
      id: createLocalId(),
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setPendingMessage('');
    setIsSending(true);
    setError(null);

    try {
      const assistantMessage = await callChatMutation(trimmed);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const fallbackMessage = {
        id: createLocalId(),
        role: 'assistant',
        content:
          err instanceof Error
            ? err.message
            : '发送失败，稍后再试或者检查 GraphQL 服务。',
      };
      setMessages((prev) => [...prev, fallbackMessage]);
      setError(
        err instanceof Error
          ? err.message
          : '发送失败，稍后再试或者检查 GraphQL 服务。'
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="App">
      <div className="chat-card">
        <header className="chat-header">
          <div>
            <p className="chat-title">DeepSeek 助教</p>
            <p className="chat-subtitle">
              通过 GraphQL 调用后台 AI：<span>{endpointLabel}</span>
            </p>
          </div>
          <div className={`status-dot ${isSending ? 'status-busy' : 'status-idle'}`} />
        </header>

        <main className="chat-body">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`message ${
                message.role === 'user' ? 'message-user' : 'message-assistant'
              }`}
            >
              <p className="message-role">
                {message.role === 'user' ? '你' : '助教'}
              </p>
              <p className="message-content">{message.content}</p>
            </article>
          ))}

          {isSending && (
            <article className="message message-assistant message-typing">
              <p className="message-role">助教</p>
              <p className="message-content typing-animation">
                正在通过 GraphQL 获取回复…
              </p>
            </article>
          )}

          <span ref={bottomRef} />
        </main>

        <form className="chat-input" onSubmit={handleSubmit}>
          <label htmlFor="chat-prompt" className="sr-only">
            输入要发送给 AI 的内容
          </label>
          <textarea
            id="chat-prompt"
            placeholder="输入你在 DeFi 或 Cloudflare Workers 中遇到的问题，按 Enter 发送或 Shift+Enter 换行。"
            value={pendingMessage}
            onChange={(event) => setPendingMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSubmit(event);
              }
            }}
            disabled={isSending}
            rows={4}
          />
          <div className="chat-actions">
            <button
              type="submit"
              disabled={isSending || !pendingMessage.trim()}
            >
              {isSending ? '发送中…' : '发送'}
            </button>
          </div>
        </form>

        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
