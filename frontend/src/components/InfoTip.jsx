import React, { useRef } from 'react';
import './InfoTip.css';

const InfoTip = ({ title, label, children, className = '' }) => {
  const dialogRef = useRef(null);

  return (
    <>
      <button
        type="button"
        className={`context-info-trigger ${className}`.trim()}
        aria-label={label || `More information: ${title}`}
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        i
      </button>
      <dialog
        ref={dialogRef}
        className="context-info-dialog"
        aria-label={title}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="context-info-content">
          <header className="context-info-header">
            <h2>{title}</h2>
            <button type="button" className="context-info-close" onClick={() => dialogRef.current?.close()} aria-label="Close information">
              ×
            </button>
          </header>
          <div className="context-info-body">{children}</div>
        </div>
      </dialog>
    </>
  );
};

export default InfoTip;