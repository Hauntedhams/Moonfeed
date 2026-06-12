import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import './CommentsSection.css';

// Wallet icon SVG
const WalletSvg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12V22H4V12"/>
    <path d="M22 7H2v5h20V7z"/>
    <path d="M12 22V7"/>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </svg>
);

const CommentsSection = ({ coinAddress, coinSymbol }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const { walletAddress, connected } = useWallet();
  const containerRef = useRef(null);
  const textareaRef = useRef(null);

  // Fetch comments for this coin
  useEffect(() => {
    if (isOpen && coinAddress) {
      fetchComments();
    }
  }, [isOpen, coinAddress]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/comments/${coinAddress}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    
    if (!connected || !walletAddress) {
      setSubmitError('Please connect your wallet to comment');
      return;
    }

    if (!newComment.trim()) {
      setSubmitError('Comment cannot be empty');
      return;
    }

    if (newComment.length > 500) {
      setSubmitError('Comment is too long (max 500 characters)');
      return;
    }

    try {
      setLoading(true);
      setSubmitError(null);

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coinAddress,
          coinSymbol,
          walletAddress,
          comment: newComment.trim(),
        }),
      });

      if (response.ok) {
        setNewComment('');
        await fetchComments(); // Refresh comments
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } else {
        const error = await response.json();
        setSubmitError(error.message || 'Failed to post comment');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      setSubmitError('Failed to post comment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTextareaChange = (e) => {
    setNewComment(e.target.value);
    setSubmitError(null);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  const toggleComments = () => {
    setIsOpen(!isOpen);
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Truncate wallet address
  const truncateAddress = (address) => {
    if (!address) return 'Unknown';
    return `${address.substring(0, 4)}..${address.substring(address.length - 4)}`;
  };

  return (
    <div className="comments-section-container" ref={containerRef}>
      {/* Comments Panel */}
      {isOpen && (
        <div className="comments-panel">
          {/* Header */}
          <div className="comments-header">
            <div className="comments-header-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span>Comments</span>
              {coinSymbol && <span className="coin-symbol-badge">${coinSymbol}</span>}
              {comments.length > 0 && (
                <span className="comments-count-pill">{comments.length}</span>
              )}
            </div>
            <button className="comments-close-btn" onClick={toggleComments} aria-label="Close comments">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="comments-content">
            {/* Comment Form or Connect Prompt */}
            {connected ? (
              <form onSubmit={handleSubmitComment} className="comment-form">
                <div className="comment-input-wrapper">
                  <textarea
                    ref={textareaRef}
                    value={newComment}
                    onChange={handleTextareaChange}
                    placeholder="Share your thoughts…"
                    className="comment-textarea"
                    maxLength={500}
                    disabled={loading}
                    rows={1}
                  />
                  <div className="comment-form-footer">
                    <span className={`char-count ${newComment.length > 450 ? 'char-count-warn' : ''}`}>
                      {newComment.length}/500
                    </span>
                    <button
                      type="submit"
                      className="comment-submit-btn"
                      disabled={loading || !newComment.trim()}
                    >
                      {loading ? (
                        <span className="btn-spinner" />
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                          </svg>
                          Post
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {submitError && (
                  <div className="comment-error">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {submitError}
                  </div>
                )}
              </form>
            ) : (
              <div className="connect-wallet-prompt">
                <div className="connect-wallet-icon-wrap">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="15" rx="2"/>
                    <path d="M16 12h.01"/>
                    <path d="M2 10V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4"/>
                  </svg>
                </div>
                <p className="connect-wallet-title">Connect to comment</p>
                <p className="connect-wallet-sub">Join the conversation for ${coinSymbol || 'this coin'}</p>
                <div className="connect-wallet-btn-wrap">
                  <UnifiedWalletButton />
                </div>
              </div>
            )}

            {/* Comments List */}
            <div className="comments-list">
              {loading && comments.length === 0 ? (
                <div className="comments-loading">
                  <div className="loading-spinner" />
                  <p>Loading comments…</p>
                </div>
              ) : comments.length === 0 ? (
                <div className="comments-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{opacity: 0.3}}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <p>No comments yet</p>
                  <p className="empty-subtext">Be the first to share your thoughts!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment._id || comment.id} className="comment-item">
                    <div className="comment-header-row">
                      <div className="comment-wallet">
                        <span className="wallet-avatar">
                          {comment.walletAddress ? comment.walletAddress[0].toUpperCase() : '?'}
                        </span>
                        <span className="wallet-address" title={comment.walletAddress}>
                          {truncateAddress(comment.walletAddress)}
                        </span>
                      </div>
                      <span className="comment-timestamp">
                        {formatTimestamp(comment.timestamp)}
                      </span>
                    </div>
                    <p className="comment-text">{comment.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Comments Button */}
      <button
        className={`comments-bubble-button ${isOpen ? 'active' : ''}`}
        onClick={toggleComments}
        aria-label="View comments"
        title={`Comments${coinSymbol ? ` for $${coinSymbol}` : ''}`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        {comments.length > 0 && (
          <span className="comment-count-badge">{comments.length > 99 ? '99+' : comments.length}</span>
        )}
      </button>
    </div>
  );
};

export default CommentsSection;
