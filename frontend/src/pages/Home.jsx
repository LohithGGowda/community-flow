import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartHandshake, ShieldAlert, Map } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="page-container animate-fade-in" style={{ padding: '16px' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '40px', marginTop: '20px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>CommunityFlow</h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: '600' }}>
          Connect. Help. Survive.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, justifyContent: 'center' }}>
        
        <button 
          className="btn-danger"
          style={{ height: '180px', flexDirection: 'column', gap: '16px' }}
          onClick={() => navigate('/crisis')}
        >
          <ShieldAlert size={64} />
          <span style={{ fontSize: '2rem' }}>I NEED HELP</span>
        </button>

        <button 
          className="btn-success"
          style={{ height: '180px', flexDirection: 'column', gap: '16px' }}
          onClick={() => navigate('/volunteer')}
        >
          <HeartHandshake size={64} />
          <span style={{ fontSize: '2rem' }}>I WANT TO HELP</span>
        </button>

      </div>

      <button 
        className="btn-outline"
        style={{ marginTop: '32px', padding: '16px' }}
        onClick={() => navigate('/analytics')}
      >
        <Map size={24} />
        View Community Map
      </button>

    </div>
  );
}
