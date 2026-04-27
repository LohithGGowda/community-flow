import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartHandshake, ShieldAlert, Map, Users, Activity, Globe, Clock, ChevronRight, Zap, Shield, Phone } from 'lucide-react';
import { getAnalyticsSummary } from '../api';

// Animates from 0 → target whenever target changes.
// Works correctly for target=0 (stays at 0 immediately).
const useAnimatedCounter = (target, duration = 1800) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    let current = 0;
    const increment = target / (duration / 16); // ~60fps
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]); // re-runs every time target changes
  return count;
};

export default function Home() {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [stats, setStats] = useState({ total_volunteers: 0, deployed_volunteers: 0, active_crises: 0 });
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    getAnalyticsSummary()
      .then(data => { setStats(data); setStatsLoaded(true); })
      .catch(() => setStatsLoaded(true)); // show zeros on error, not fake numbers
  }, []);

  const volunteers  = useAnimatedCounter(stats.total_volunteers);
  const deployed    = useAnimatedCounter(stats.deployed_volunteers);
  const crisisZones = useAnimatedCounter(stats.active_crises);

  return (
    <div className="page-container animate-fade-in" style={{ padding: '16px', gap: '0' }}>
      
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginTop: '16px', marginBottom: '24px' }}>
        {/* Logo */}
        <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(59,130,246,0.3)' }}>
          <Zap size={36} color="white" />
        </div>
        <h1 style={{ fontSize: '2.8rem', marginBottom: '4px', background: 'linear-gradient(135deg, #1E293B 0%, #3B82F6 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CommunityFlow</h1>
        <p style={{ fontSize: '1.15rem', color: 'var(--text-muted)', fontWeight: '600', lineHeight: '1.4' }}>
          AI-Powered Volunteer Coordination
        </p>
      </div>

      {/* Live Stats Banner — sourced from GET /api/analytics/summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '28px' }}>
        <div style={{ background: '#EFF6FF', padding: '16px 8px', borderRadius: '16px', textAlign: 'center',
                      opacity: statsLoaded ? 1 : 0.5, transition: 'opacity 0.4s' }}>
          <Users size={22} color="#3B82F6" style={{ marginBottom: '4px' }} />
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1E40AF' }}>
            {statsLoaded ? volunteers : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Volunteers</div>
        </div>
        <div style={{ background: '#F0FDF4', padding: '16px 8px', borderRadius: '16px', textAlign: 'center',
                      opacity: statsLoaded ? 1 : 0.5, transition: 'opacity 0.4s' }}>
          <Activity size={22} color="#16A34A" style={{ marginBottom: '4px' }} />
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#166534' }}>
            {statsLoaded ? deployed : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Deployed</div>
        </div>
        <div style={{ background: '#FFF7ED', padding: '16px 8px', borderRadius: '16px', textAlign: 'center',
                      opacity: statsLoaded ? 1 : 0.5, transition: 'opacity 0.4s' }}>
          <Globe size={22} color="#EA580C" style={{ marginBottom: '4px' }} />
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#9A3412' }}>
            {statsLoaded ? crisisZones : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Crisis Zones</div>
        </div>
      </div>

      {/* Main Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, justifyContent: 'center' }}>
        
        <button 
          className="btn-danger"
          style={{ height: '160px', flexDirection: 'column', gap: '12px', position: 'relative', overflow: 'hidden' }}
          onClick={() => navigate('/crisis')}
        >
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
          <ShieldAlert size={56} />
          <span style={{ fontSize: '1.8rem' }}>I NEED HELP</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 'normal', opacity: 0.9 }}>Find volunteers for a crisis</span>
        </button>

        <button 
          className="btn-success"
          style={{ height: '160px', flexDirection: 'column', gap: '12px', position: 'relative', overflow: 'hidden' }}
          onClick={() => navigate('/volunteer')}
        >
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
          <HeartHandshake size={56} />
          <span style={{ fontSize: '1.8rem' }}>I WANT TO HELP</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 'normal', opacity: 0.9 }}>Register as a volunteer</span>
        </button>

      </div>

      {/* Secondary Actions */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
        <button 
          className="btn-outline"
          style={{ flex: 1, padding: '18px 12px', flexDirection: 'column', gap: '6px', fontSize: '1rem' }}
          onClick={() => navigate('/analytics')}
        >
          <Map size={22} color="var(--primary)" />
          Community Map
        </button>
        <button 
          className="btn-outline"
          style={{ flex: 1, padding: '18px 12px', flexDirection: 'column', gap: '6px', fontSize: '1rem' }}
          onClick={() => window.location.href = 'tel:112'}
        >
          <Phone size={22} color="var(--danger)" />
          Emergency: 112
        </button>
      </div>

      {/* Trust Footer */}
      <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <Shield size={16} color="#16A34A" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Powered by Google AI · End-to-end encrypted</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Clock size={14} color="#94A3B8" />
          <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontFamily: 'monospace' }}>
            {time.toLocaleTimeString('en-IN', { hour12: true })}
          </span>
        </div>
      </div>

    </div>
  );
}
