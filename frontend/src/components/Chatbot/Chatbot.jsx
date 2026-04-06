import { useState, useEffect, useRef } from 'react';
import { sendChatMessage } from '../../services/api';
import styles from './Chatbot.module.css';

const WELCOME_MESSAGE = {
  type: 'bot',
  text: '👋 Xin chào! Tôi là trợ lý tư vấn học tập AI.\nHãy hỏi tôi về GPA, đăng ký môn học, lộ trình học tập hoặc bất kỳ vấn đề học tập nào nhé!',
};

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Listen for openChatbot custom event from Sidebar
  useEffect(() => {
    const handler = () => setIsOpen(true);
    document.addEventListener('openChatbot', handler);
    return () => document.removeEventListener('openChatbot', handler);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    setMessages((prev) => [...prev, { type: 'user', text }]);
    setInput('');
    setIsTyping(true);

    try {
      // Delay for typing effect
      await new Promise((r) => setTimeout(r, 800));
      const res = await sendChatMessage(text);
      setMessages((prev) => [...prev, { type: 'bot', text: res.data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { type: 'bot', text: '❌ Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại.' },
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
      {/* Floating bubble */}
      {!isOpen && (
        <button
          className={styles.bubble}
          onClick={() => setIsOpen(true)}
          title="Tư vấn AI"
        >
          💬
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <>
          <div className={styles.overlay} onClick={() => setIsOpen(false)} />
          <div className={styles.chatWindow}>
            {/* Header */}
            <div className={styles.chatHeader}>
              <div className={styles.chatHeaderLeft}>
                <span className={styles.chatHeaderIcon}>🤖</span>
                <div>
                  <div className={styles.chatHeaderTitle}>Tư vấn học tập</div>
                  <div className={styles.chatHeaderStatus}>● Đang hoạt động</div>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                ✕
              </button>
            </div>

            {/* Messages */}
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

            {/* Input */}
            <div className={styles.chatInput}>
              <input
                className={styles.inputField}
                type="text"
                placeholder="Nhập câu hỏi của bạn..."
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
