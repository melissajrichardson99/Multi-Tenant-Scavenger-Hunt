import React from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Rendered into document.body via portal: several ancestor cards use
  // backdrop-filter, which (like transform) makes an element the containing
  // block for its position:fixed descendants — without the portal, the
  // overlay would be clipped to that ancestor's card instead of the viewport.
  return createPortal(
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}
