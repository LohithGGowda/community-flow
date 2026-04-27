import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartHandshake, ShieldAlert, BarChart3 } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="page-container animate-fade-in" style={{ justifyContent: 'center' }}>
      <div className="page-header">
        <h1 className="page-title">CommunityFlow</h1>
        <p className="page-subtitle">Connecting those who can help with those who need it most.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <button 
          className="btn-primary glass-card"
          style={{ padding: '32px 24px', flexDirection: 'column', gap: '16px' }}
          onClick={() => navigate('/volunteer')}
        >
          <HeartHandshake size={48} />
          <div>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>I want to Help</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.8, fontWeight: 'normal' }}>Sign up as a volunteer</div>
          </div>
        </button>

        <button 
          className="btn-secondary glass-card"
          style={{ padding: '32px 24px', flexDirection: 'column', gap: '16px' }}
          onClick={() => navigate('/crisis')}
        >
          <ShieldAlert size={48} />
          <div>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>We need Help</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.8, fontWeight: 'normal' }}>Find specific volunteers</div>
          </div>
        </button>

        <button 
          className="glass-card"
          style={{ 
            padding: '24px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '12px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'white',
            cursor: 'pointer',
            borderRadius: '16px'
          }}
          onClick={() => navigate('/analytics')}
        >
          <BarChart3 size={24} color="#94a3b8" />
          <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>View Community Needs</span>
        </button>
      </div>
    </div>
  );
}
