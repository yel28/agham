import React from 'react';

export default function MainContent({ title, children, sidebarActive }) {
  return (
    <div className={`main--content${sidebarActive ? ' active' : ''}`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className={`overview${!title ? ' no-title' : ''}`}>
        {title && (
          <div className="title">
            <h2 className="section--title">{title}</h2>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}


