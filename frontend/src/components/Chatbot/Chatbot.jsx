import { useEffect, useRef, useState } from 'react';
import { sendChatMessage } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Chatbot.module.css';

const WELCOME_MESSAGE = {
  type: 'bot',
  text: 'Xin chào! Mình là trợ lý học vụ AI.\nBạn có thể hỏi mình về GPA, tín chỉ, chương trình khung, quy chế học vụ hoặc tiến độ tốt nghiệp.',
  sources: [],
};

const buildSessionId = () => `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default function Chatbot() {
  const { user, role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const sessionIdRef = useRef(buildSessionId());

  useEffect(() => {
    const handler = () => setIsOpen(true);
    document.addEventListener('openChatbot', handler);
    return () => document.removeEventListener('openChatbot', handler);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const studentId = user?.mssv || null;
  const programName = user?.program_name || user?.nganh || user?.chuyen_nganh || null;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    setMessages((prev) => [...prev, { type: 'user', text }]);
    setInput('');
    setIsTyping(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const res = await sendChatMessage({
        message: text,
        student_id: studentId,
        role,
        session_id: sessionIdRef.current,
        program_name: programName,
      });
      setMessages((prev) => [
        ...prev,
        {
          type: 'bot',
          text: res.data.reply,
          sources: res.data.sources || [],
          intent: res.data.intent,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          type: 'bot',
          text: 'Xin lỗi, hệ thống chatbot đang gặp lỗi. Bạn thử lại sau nhé.',
          sources: [],
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          className={styles.bubble}
          onClick={() => setIsOpen(true)}
          title="Tư vấn AI"
        >
          💬
        </button>
      )}

      {isOpen && (
        <>
          <div className={styles.overlay} onClick={() => setIsOpen(false)} />
          <div className={styles.chatWindow}>
            <div className={styles.chatHeader}>
              <div className={styles.chatHeaderLeft}>
                <span className={styles.chatHeaderIcon}>🤖</span>
                <div>
                  <div className={styles.chatHeaderTitle}>Tư vấn học vụ AI</div>
                  <div className={styles.chatHeaderStatus}>● Ollama + RAG + PostgreSQL</div>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                ✕
              </button>
            </div>

            <div className={styles.chatMessages}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`${styles.messageRow} ${
                    msg.type === 'bot' ? styles.messageBot : styles.messageUser
                  }`}
                >
                  <div
                    className={`${styles.messageBubble} ${
                      msg.type === 'bot'
                        ? styles.messageBubbleBot
                        : styles.messageBubbleUser
                    }`}
                  >
                    {msg.text}
                    {msg.type === 'bot' && msg.sources?.length > 0 && (
                      <div className={styles.sources}>
                        {msg.sources.map((source) => (
                          <span key={source} className={styles.sourceTag}>
                            {source}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className={`${styles.messageRow} ${styles.messageBot}`}>
                  <div className={styles.typingDots}>
                    <span className={styles.typingDot} />
                    <span className={styles.typingDot} />
                    <span className={styles.typingDot} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles.chatInput}>
              <input
                className={styles.inputField}
                type="text"
                placeholder="Nhập câu hỏi học vụ của bạn..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isTyping}
              />
              <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
              >
                ➤
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
