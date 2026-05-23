import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import styles from './FloatingChatButton.module.css';

export default function FloatingChatButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isParent } = useAuth(); // Parents don't have chat access

  // Don't show if on chat page or if user is a parent
  if (location.pathname === '/chat' || isParent) {
    return null;
  }

  return (
    <div className={styles.container} onClick={() => navigate('/chat')}>
      <div className={styles.btnShadow}></div>
      <button className={styles.chatFloatBtn} aria-label="Mở tư vấn AI">
        <span className={styles.icon}>💬</span>
      </button>
      <div className={styles.tooltip}>Trợ lý AI</div>
    </div>
  );
}
