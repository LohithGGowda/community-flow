import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Loader2, User, MapPin, Send,
  CheckCircle, XCircle, Zap, AlertTriangle,
} from 'lucide-react';
import { matchVolunteers, updateVolunteerStatus } from '../api';

// Urgency badge colours
const URGENCY_STYLE = {
  critical: { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA', label: '🔴 CRITICAL' },
  high:     { bg: '#FFF7ED', color: '#9A3412', border: '#FED7AA', label: '🟠 HIGH' },
  normal:   { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE', label: '🔵 NORMAL' },
  low:      { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0', label: '🟢 LOW' },
};

export default function CrisisDashboard() {
  const navigate = useNavigate();
  const [loading,      setLoading]      = useState(false);
  const [matches,      setMatches]      = useState([]);
  const [deployStatus, setDeployStatus] = useState({});
  const [autoUrgency,  setAutoUrgency]  = useState(null);
  const [error,        setError]        = useState('');

  const [formData, setFormData] = useState({
    description:      '',
    required_skills:  '',
    location:         '',
    volunteers_needed: 5,
    urgency:          'high',   // sent to backend; backend may override via Gemini
  });

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setDeployStatus({});
    setAutoUrgency(null);
    setError('');

    try {
      const payload = {
        ...formData,
        required_skills: formData.required_skills
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      };

      const data = await matchVolunteers(payload);
      setMatches(data.matches || []);

      // The backend auto-classifies urgency and echoes it back in crisis_request
      if (data.crisis_request?.urgency) {
        setAutoUrgency(data.crisis_request.urgency);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Deploy ───────────────────────────────────────────────────────────────
  const handleSendAlert = async (volunteerId) => {
    setDeployStatus(prev => ({ ...prev, [volunteerId]: 'polling' }));
    // Simulate FCM response (replace with real push notification in production)
    setTimeout(() => {
      const accepted = Math.random() > 0.3;
      setDeployStatus(prev => ({ ...prev, [volunteerId]: accepted ? 'deployed' : 'declined' }));
      if (accepted) {
        updateVolunteerStatus(volunteerId, 'busy').catch(console.error);
      }
    }, 3000);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="page-container animate-fade-in">

      {/* Back */}
      <button
        className="btn-outline"
        onClick={() => navigate('/')}
        style={{ width: 'auto', alignSelf: 'flex-start', padding: '12px 20px', marginBottom: '24px' }}
      >
        <ArrowLeft size={24} /> Back
      </button>

      {/* Header */}
      <div className="page-header" style={{ textAlign: 'left' }}>
        <h1 className="page-title">Find Help Fast</h1>
        <p className="page-subtitle" style={{ fontSize: '1.2rem' }}>
          Tell us what is happening and we will find the right people.
        </p>
      </div>

      {/* Form */}
      <div className="accessible-card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>

          <label>1. What happened?</label>
          <textarea
            required
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder="e.g. A flood damaged 5 houses in the lower ward. Families need food and medical help."
            style={{ minHeight: '120px' }}
          />

          <label>2. Where is it?</label>
          <input
            required
            value={formData.location}
            onChange={e => setFormData({ ...formData, location: e.target.value })}
            placeholder="e.g. HSR Layout, Bangalore"
          />

          <label>3. What skills are needed? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(comma-separated)</span></label>
          <input
            required
            value={formData.required_skills}
            onChange={e => setFormData({ ...formData, required_skills: e.target.value })}
            placeholder="e.g. Medical, Driving, First Aid"
          />

          <label>4. How many volunteers?</label>
          <input
            type="number"
            min={1}
            max={50}
            value={formData.volunteers_needed}
            onChange={e => setFormData({ ...formData, volunteers_needed: parseInt(e.target.value) || 1 })}
          />

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              color: '#991B1B', background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: '10px', padding: '10px 14px', marginBottom: '8px', fontSize: '0.9rem',
            }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ height: '80px', marginTop: '8px' }}
          >
            {loading ? <Loader2 className="animate-spin" size={32} /> : <Search size={32} />}
            {loading ? 'SEARCHING...' : 'FIND PEOPLE'}
          </button>
        </form>
      </div>

      {/* Auto-urgency badge — shown after first search */}
      {autoUrgency && (() => {
        const s = URGENCY_STYLE[autoUrgency] || URGENCY_STYLE.normal;
        return (
          <div className="animate-fade-in" style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: s.bg, border: `2px solid ${s.border}`,
            borderRadius: '14px', padding: '12px 18px', marginTop: '16px',
          }}>
            <Zap size={18} color={s.color} />
            <div>
              <span style={{ fontWeight: 700, color: s.color, fontSize: '0.9rem' }}>
                AI Severity Assessment: {s.label}
              </span>
              <p style={{ margin: 0, fontSize: '0.8rem', color: s.color, opacity: 0.8 }}>
                Gemini classified this crisis based on your description.
              </p>
            </div>
          </div>
        );
      })()}

      {/* Results */}
      {matches.length > 0 && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '24px' }}>
          <h2 style={{ margin: 0 }}>
            Found {matches.length} Volunteer{matches.length !== 1 ? 's' : ''}
            <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>
              ranked by skill + proximity
            </span>
          </h2>

          {matches.map((match, idx) => {
            const status = deployStatus[match.volunteer_id];
            const scorePercent = Math.round(match.match_score * 100);
            const scoreColor = scorePercent >= 70 ? '#16A34A' : scorePercent >= 40 ? '#D97706' : '#DC2626';

            return (
              <div
                key={idx}
                className="accessible-card"
                style={{
                  padding: '24px',
                  border: status === 'deployed' ? '3px solid #16A34A' : '2px solid var(--border-color)',
                  transition: 'border 0.2s',
                }}
              >
                {/* Volunteer header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: '#E2E8F0', padding: '16px', borderRadius: '50%', color: 'var(--primary)', flexShrink: 0 }}>
                      <User size={32} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.4rem' }}>
                        {match.volunteer_details?.name || 'Volunteer'}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '1rem', marginTop: '4px' }}>
                        <MapPin size={16} />
                        {match.volunteer_details?.location || 'Unknown location'}
                      </div>
                    </div>
                  </div>

                  {/* Match score badge */}
                  <div style={{
                    background: scoreColor + '18',
                    color: scoreColor,
                    border: `2px solid ${scoreColor}44`,
                    padding: '8px 14px',
                    borderRadius: '16px',
                    fontSize: '1rem',
                    fontWeight: 800,
                    textAlign: 'center',
                    minWidth: '72px',
                    flexShrink: 0,
                  }}>
                    {scorePercent}%
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, opacity: 0.8 }}>MATCH</div>
                  </div>
                </div>

                {/* Skills */}
                <div style={{
                  fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '20px',
                  background: '#F8FAFC', padding: '12px', borderRadius: '12px',
                }}>
                  <strong>Can do:</strong>{' '}
                  {match.volunteer_details?.skills?.join(', ') || 'General assistance'}
                </div>

                {/* Languages */}
                {match.volunteer_details?.languages?.length > 0 && (
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    🗣 Speaks: {match.volunteer_details.languages.join(', ')}
                  </div>
                )}

                {/* Deploy button */}
                {!status ? (
                  <button className="btn-primary" style={{ height: '70px' }}
                    onClick={() => handleSendAlert(match.volunteer_id)}>
                    <Send size={24} /> MESSAGE THEM
                  </button>
                ) : status === 'polling' ? (
                  <button className="btn-outline" style={{ height: '70px' }} disabled>
                    <Loader2 size={24} className="animate-spin" /> WAITING FOR REPLY...
                  </button>
                ) : status === 'deployed' ? (
                  <button className="btn-success" style={{ height: '70px' }} disabled>
                    <CheckCircle size={24} /> THEY ARE COMING
                  </button>
                ) : (
                  <button className="btn-danger" style={{ height: '70px' }} disabled>
                    <XCircle size={24} /> THEY CANNOT COME
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state after search */}
      {!loading && matches.length === 0 && autoUrgency && (
        <div className="animate-fade-in" style={{
          textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)',
        }}>
          <Search size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p style={{ fontSize: '1.1rem' }}>No volunteers found yet.</p>
          <p style={{ fontSize: '0.9rem' }}>
            Register more volunteers via the "I WANT TO HELP" flow, then try again.
          </p>
        </div>
      )}
    </div>
  );
}
