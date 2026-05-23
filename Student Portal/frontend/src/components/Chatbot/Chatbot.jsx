import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { sendChatMessage } from '../../services/api';
import styles from './Chatbot.module.css';

const SUGGESTIONS = [
  {
    label: "Tra cứu điểm",
    text: "Điểm GPA hiện tại của tôi là bao nhiêu?",
    icon: "📈",
    bg: "rgba(59, 130, 246, 0.15)",
    color: "var(--primary-light)"
  },
  {
    label: "Tiến độ học tập",
    text: "Tôi còn cần bao nhiêu tín chỉ để tốt nghiệp?",
    icon: "🎓",
    bg: "rgba(16, 185, 129, 0.15)",
    color: "var(--success)"
  },
  {
    label: "Chương trình đào tạo",
    text: "Chương trình khung ngành của tôi là gì?",
    icon: "📋",
    bg: "rgba(139, 92, 246, 0.15)",
    color: "#8b5cf6"
  },
  {
    label: "Hỗ trợ học vụ",
    text: "Quy định về cảnh cáo học vụ như thế nào?",
    icon: "⚠️",
    bg: "rgba(245, 158, 11, 0.15)",
    color: "var(--warning)"
  }
];

const buildSessionId = () => `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default function Chatbot() {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('iuh_chat_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    if (sessions.length > 0) return sessions[0].id;
    return buildSessionId();
  });

  const [messages, setMessages] = useState(() => {
    if (activeSessionId) {
      const s = sessions.find((x) => x.id === activeSessionId);
      if (s) return s.messages;
    }
    return [];
  });

  // Filter out any default WELCOME messages from legacy data
  useEffect(() => {
    if (messages.length > 0 && messages[0].text.includes('Xin chào! Mình là trợ lý học vụ AI')) {
        setMessages(messages.slice(1));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('iuh_chat_history', JSON.stringify(sessions));
  }, [sessions]);

  const updateActiveSession = (newMessages, titleUpdate = null) => {
    setMessages(newMessages);
    setSessions((prev) => {
      let updated = false;
      const newSessions = prev.map((s) => {
        if (s.id === activeSessionId) {
          updated = true;
          return {
            ...s,
            messages: newMessages,
            title: titleUpdate || s.title || 'Đoạn chat mới',
            updatedAt: Date.now(),
          };
        }
        return s;
      });

      if (!updated) {
        newSessions.unshift({
          id: activeSessionId,
          title: titleUpdate || 'Đoạn chat mới',
          messages: newMessages,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      return newSessions.sort((a, b) => b.updatedAt - a.updatedAt);
    });
  };

  const handleNewChat = () => {
    const newId = buildSessionId();
    setActiveSessionId(newId);
    setMessages([]);
  };

  const selectSession = (id) => {
    const s = sessions.find((x) => x.id === id);
    if (s) {
      setActiveSessionId(id);
      setMessages(s.messages);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const role = user?.role || 'student';
  const studentId = user?.mssv || null;
  const programName = user?.program_name || user?.nganh || user?.chuyen_nganh || null;

  const handleSendText = async (textToSend) => {
    if (!textToSend || isTyping) return;

    let titleUpdate = null;
    if (messages.length === 0) {
      titleUpdate = textToSend.length > 25 ? textToSend.substring(0, 25) + '...' : textToSend;
    }

    const newMessages = [...messages, { type: 'user', text: textToSend }];
    updateActiveSession(newMessages, titleUpdate);
    
    setIsTyping(true);

    try {
      const res = await sendChatMessage({
        message: textToSend,
        student_id: studentId,
        role,
        session_id: activeSessionId,
        program_name: programName,
      });
      
      updateActiveSession([
        ...newMessages,
        {
          type: 'bot',
          text: res.data.reply,
          sources: res.data.sources || [],
          intent: res.data.intent,
        },
      ]);
    } catch {
      updateActiveSession([
        ...newMessages,
        {
          type: 'bot',
          text: 'Xin lỗi, hệ thống máy chủ AI đang gặp quá tải hoặc bảo trì. Vui lòng thử lại sau giây lát.',
          sources: [],
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    handleSendText(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderSources = (sources) => {
    if (!sources || sources.length === 0) return null;
    return (
      <div className={styles.sourcesContainer}>
        <div className={styles.sourcesTitle}>Nguồn tham khảo:</div>
        <ul className={styles.sourcesList}>
          {sources.map((src, idx) => (
            <li key={idx} className={styles.sourceItem}>
              {src.file_id || 'Tài liệu'} (Trang {src.page || '?'}) - Độ tin cậy: {Math.round((src.score || 0) * 100)}%
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className={styles.chatPage}>
      {/* Sidebar History */}
      <div className={styles.historySidebar}>
        <button className={styles.newChatBtn} onClick={handleNewChat}>
          <span className={styles.newChatIcon}>+</span> Đoạn chat mới
        </button>
        <div className={styles.historyList}>
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`${styles.historyItem} ${s.id === activeSessionId ? styles.activeHistory : ''}`}
              onClick={() => selectSession(s.id)}
            >
              <div className={styles.historyIcon}>💬</div>
              <div className={styles.historyTitle}>{s.title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={styles.chatArea}>
        <div className={styles.chatHeader}>
          <div className={styles.headerTitleGroup}>
            <span className={styles.headerLogo}>✨</span>
            <div className={styles.headerTexts}>
              <h2>Trợ lý Tư Vấn IUH AI</h2>
              <p>Mô hình Ollama • RAG • Trực tiếp từ CSDL sinh viên</p>
            </div>
          </div>
        </div>

        <div className={styles.chatScrollArea}>
          {messages.length === 0 ? (
            <div className={styles.emptyStateContainer}>
              <div className={styles.heroSection}>
                <div className={styles.heroGlow}></div>
                <div className={styles.heroIcon}>✨</div>
                <h2 className={styles.heroTitle}>
                  Xin chào, <span className={styles.heroName}>{user?.name?.split(' ').pop() || 'bạn'}</span>!
                </h2>
                <p className={styles.heroSubtitle}>Bạn cần được hỗ trợ gì về học vụ hôm nay?</p>
              </div>

              <div className={styles.heroSuggestions}>
                {SUGGESTIONS.map((s, idx) => (
                  <button key={idx} className={styles.heroSuggestionCard} onClick={() => handleSendText(s.text)}>
                    <div className={styles.suggestionIconWrapper} style={{ background: s.bg, color: s.color }}>
                      {s.icon}
                    </div>
                    <div className={styles.suggestionContent}>
                      <div className={styles.suggestionLabel}>{s.label}</div>
                      <div className={styles.suggestionText}>{s.text}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.chatMessagesWrapper}>
              {messages.map((msg, i) => (
                <div key={i} className={`${styles.messageBlock} ${msg.type === 'user' ? styles.messageBlockUser : styles.messageBlockBot}`}>
                  {msg.type === 'bot' && (
                    <div className={styles.botAvatar}>
                      <span className={styles.botAvatarIcon}>✨</span>
                    </div>
                  )}
                  <div className={styles.messageContent}>
                    <div className={styles.messageText}>{msg.text}</div>
                    {msg.intent && <div className={styles.intentBadge}>Phân loại: {msg.intent}</div>}
                    {msg.type === 'bot' && renderSources(msg.sources)}
                  </div>
                </div>
              ))}

              {isTyping && (
                 <div className={`${styles.messageBlock} ${styles.messageBlockBot}`}>
                  <div className={styles.botAvatar}>
                    <span className={styles.botAvatarIcon}>✨</span>
                  </div>
                  <div className={styles.messageContent}>
                    <div className={styles.typingIndicator}>
                      <span className={styles.typingDot}></span>
                      <span className={styles.typingDot}></span>
                      <span className={styles.typingDot}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className={styles.inputAreaWrapper}>
          <div className={styles.inputContainer}>
            <textarea
              className={styles.chatInput}
              placeholder="Nhắn tin cho Trợ lý AI..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              className={`${styles.sendBtn} ${input.trim() ? styles.sendBtnActive : ''}`}
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
            >
              ⬆
            </button>
          </div>
          <div className={styles.disclaimer}>IUH AI có thể phản hồi chưa chính xác hoàn toàn. Hãy kiểm chứng lại thông tin quan trọng.</div>
        </div>
      </div>
    </div>
  );
}
