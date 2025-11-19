import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../contexts/WalletContext';
import './CommentsSection.css';

const CommentsSection = ({ coinAddress, coinSymbol }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const { walletAddress, connected, connect } = useWallet();
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
          <div className="comments-header">
            <h3>
              💬 Comments {coinSymbol && <span className="coin-symbol-badge">${coinSymbol}</span>}
            </h3>
            <button 
              className="comments-close-btn" 
              onClick={toggleComments}
              aria-label="Close comments"
            >
              ×
            </button>
          </div>

          <div className="comments-content">
            {/* Comment Form */}
            {connected ? (
              <form onSubmit={handleSubmitComment} className="comment-form">
                <div className="comment-input-wrapper">
                  <textarea
                    ref={textareaRef}
                    value={newComment}
                    onChange={handleTextareaChange}
                    placeholder="Share your thoughts..."
                    className="comment-textarea"
                    maxLength={500}
                    disabled={loading}
                    rows={1}
                  />
                  <div className="comment-form-footer">
                    <span className="char-count">
                      {newComment.length}/500
                    </span>
                    <button 
                      type="submit" 
                      className="comment-submit-btn"
                      disabled={loading || !newComment.trim()}
                    >
                      {loading ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                </div>
                {submitError && (
                  <div className="comment-error">
                    ⚠️ {submitError}
                  </div>
                )}
              </form>
            ) : (
              <div className="connect-wallet-prompt">
                <div className="connect-wallet-icon">🔒</div>
                <p>Connect your wallet to join the conversation</p>
                <button 
                  className="connect-wallet-cta"
                  onClick={async () => {
                    try {
                      await connect();
                    } catch (error) {
                      console.error('Failed to connect wallet:', error);
                    }
                  }}
                >
                  Connect Wallet
                </button>
              </div>
            )}

            {/* Comments List */}
            <div className="comments-list">
              {loading && comments.length === 0 ? (
                <div className="comments-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading comments...</p>
                </div>
              ) : comments.length === 0 ? (
                <div className="comments-empty">
                  <div className="empty-icon">💭</div>
                  <p>No comments yet</p>
                  <p className="empty-subtext">Be the first to share your thoughts!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment._id || comment.id} className="comment-item">
                    <div className="comment-header-row">
                      <div className="comment-wallet">
                        <span className="wallet-icon">👛</span>
                        <span className="wallet-address" title={comment.walletAddress}>
                          {truncateAddress(comment.walletAddress)}
                        </span>
                      </div>
                      <div className="comment-timestamp">
                        {formatTimestamp(comment.timestamp)}
                      </div>
                    </div>
                    <div className="comment-text">
                      {comment.comment}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Arrow pointing down to the button */}
          <div className="comments-panel-arrow"></div>
        </div>
      )}

      {/* Comments Button */}
      <button
        className={`comments-bubble-button ${isOpen ? 'active' : ''}`}
        onClick={toggleComments}
        aria-label="View comments"
        title={`Comments${coinSymbol ? ` for ${coinSymbol}` : ''}`}
      >
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        {comments.length > 0 && (
          <span className="comment-count-badge">{comments.length}</span>
        )}
      </button>
    </div>
  );
};

export default CommentsSection;
