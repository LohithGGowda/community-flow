import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getVolunteers, getCrises } from '../api';

// leaflet.heat requires window.L to be set before import
window.L = L;
import 'leaflet.heat';

// Fix default marker icons broken by webpack/vite asset hashing
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ---------------------------------------------------------------------------
// Pin factory
// ---------------------------------------------------------------------------
const createPin = (color, size = 18) => new L.DivIcon({
  className: 'custom-pin',
  html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
  iconSize:   [size + 6, size + 6],
  iconAnchor: [(size + 6) / 2, (size + 6) / 2],
});
const greenPin  = createPin('#16A34A');
const redPin    = createPin('#DC2626');
const orangePin = createPin('#D97706');

// ---------------------------------------------------------------------------
// Local geocoding fallback (mirrors app/services/geo.py)
// Used only for display — backend does the authoritative geocoding
// ---------------------------------------------------------------------------
const LOCATION_COORDS = {
  'koramangala':    [12.9352, 77.6245],
  'hsr layout':     [12.9121, 77.6446],
  'hsr':            [12.9121, 77.6446],
  'indiranagar':    [12.9784, 77.6408],
  'jayanagar':      [12.9308, 77.5838],
  'rajajinagar':    [12.9911, 77.5546],
  'btm layout':     [12.9166, 77.6101],
  'btm':            [12.9166, 77.6101],
  'basavanagudi':   [12.9434, 77.5712],
  'whitefield':     [12.9698, 77.7500],
  'electronic city':[12.8440, 77.6568],
  'marathahalli':   [12.9591, 77.6974],
  'hebbal':         [13.0354, 77.5970],
  'shivajinagar':   [12.9850, 77.6010],
  'malleswaram':    [13.0035, 77.5680],
  'jp nagar':       [12.9102, 77.5850],
  'mandya':         [12.5220, 76.8950],
  'mysore':         [12.2958, 76.6394],
  'mysuru':         [12.2958, 76.6394],
  'hubli':          [15.3647, 75.1240],
  'mangalore':      [12.9141, 74.8560],
  'mangaluru':      [12.9141, 74.8560],
  'tumkur':         [13.3379, 77.1173],
  'hassan':         [13.0068, 76.1004],
  'bangalore':      [12.9716, 77.5946],
  'bengaluru':      [12.9716, 77.5946],
  'chennai':        [13.0827, 80.2707],
  'hyderabad':      [17.3850, 78.4867],
  'mumbai':         [19.0760, 72.8777],
  'delhi':          [28.7041, 77.1025],
  'pune':           [18.5204, 73.8567],
};

function geocodeLocation(locationStr) {
  if (!locationStr) return [12.9716, 77.5946];
  const lower = locationStr.toLowerCase();
  let bestKey = null, bestLen = 0;
  for (const [key] of Object.entries(LOCATION_COORDS)) {
    if (lower.includes(key) && key.length > bestLen) {
      bestKey = key; bestLen = key.length;
    }
  }
  if (bestKey) return LOCATION_COORDS[bestKey];
  // Unknown — jitter around Bangalore so pins don't stack
  return [12.9716 + (Math.random() - 0.5) * 0.06, 77.5946 + (Math.random() - 0.5) * 0.06];
}

// ---------------------------------------------------------------------------
// Urgency → colour mapping
// ---------------------------------------------------------------------------
const URGENCY_COLOR = {
  critical: '#DC2626',
  high:     '#D97706',
  normal:   '#3B82F6',
  low:      '#10B981',
};

const URGENCY_RADIUS = {
  critical: 1800,
  high:     1200,
  normal:   800,
  low:      500,
};

// ---------------------------------------------------------------------------
// Heatmap layer — driven by live crisis data
// ---------------------------------------------------------------------------
function TrueHeatmapLayer({ hotspots }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !hotspots.length) return;
    const points = hotspots.map(h => [h.pos[0], h.pos[1], Math.min(h.reports * 8, 100)]);
    const layer = L.heatLayer(points, {
      radius: 45, blur: 35, maxZoom: 13, minOpacity: 0.35,
      gradient: { 0.3: '#3b82f6', 0.5: '#10b981', 0.7: '#f59e0b', 1.0: '#ef4444' },
    }).addTo(map);
    return () => map.removeLayer(layer);
  }, [map, hotspots]);
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState('all');
  const [volunteers, setVolunteers] = useState([]);
  const [hotspots,   setHotspots]   = useState([]);
  const [error,      setError]      = useState('');

  const center = [12.9716, 77.5946];

  // ---------------------------------------------------------------------------
  // Data fetching — volunteers + crises in parallel
  // ---------------------------------------------------------------------------
  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const [volData, crisisData] = await Promise.all([
        getVolunteers().catch(() => []),
        getCrises().catch(() => []),
      ]);

      // Map volunteers to map-ready objects
      const mapped = volData.map(v => ({
        id:       v.id,
        name:     v.name || 'Unnamed Volunteer',
        status:   v.status || 'available',
        skills:   Array.isArray(v.skills) ? v.skills.join(', ') : (v.skills || 'General'),
        location: v.location || 'Unknown',
        pos:      v.geo_location
                    ? [v.geo_location.lat, v.geo_location.lng]
                    : geocodeLocation(v.location),
        phone:    v.contact_info || '',
      }));
      setVolunteers(mapped);

      // Map crises to heatmap hotspots
      const spots = crisisData.map((c, i) => {
        const pos = c.geo_location
          ? [c.geo_location.lat, c.geo_location.lng]
          : geocodeLocation(c.location);
        return {
          id:      c.id || i,
          pos,
          label:   c.description
                     ? c.description.slice(0, 60) + (c.description.length > 60 ? '…' : '')
                     : c.location,
          urgency: c.urgency || 'normal',
          reports: c.reports || 1,
          location: c.location || '',
          timestamp: c.timestamp || '',
        };
      });
      setHotspots(spots);
    } catch (err) {
      setError('Could not load map data. Is the backend running?');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const id = setInterval(fetchAll, 10000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // ---------------------------------------------------------------------------
  // Derived stats
  // ---------------------------------------------------------------------------
  const filteredVols    = filter === 'all'       ? volunteers
                        : filter === 'available' ? volunteers.filter(v => v.status === 'available')
                        :                          volunteers.filter(v => v.status !== 'available');
  const availableCount  = volunteers.filter(v => v.status === 'available').length;
  const deployedCount   = volunteers.filter(v => v.status !== 'available').length;
  const criticalCount   = hotspots.filter(h => h.urgency === 'critical').length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-color)' }}>

      {/* ── Header ── */}
      <div style={{ padding: '16px 16px 0', zIndex: 1000, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <button className="btn-outline" onClick={() => navigate('/')}
            style={{ width: 'auto', padding: '10px 16px', marginBottom: 0 }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Community Needs Map</h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
              Live data · {hotspots.length} active crisis zone{hotspots.length !== 1 ? 's' : ''} · auto-refreshes every 10s
            </p>
          </div>
          <button onClick={fetchAll} disabled={refreshing}
            style={{ width: 'auto', padding: '10px', borderRadius: '12px', background: '#F1F5F9',
                     border: '2px solid var(--border-color)', color: 'var(--text-main)',
                     boxShadow: 'none', marginBottom: 0, cursor: 'pointer' }}>
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FEF2F2',
                        border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 14px',
                        marginBottom: '10px', color: '#991B1B', fontSize: '0.85rem' }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <div style={{ flex: 1, background: '#F0FDF4', padding: '12px', borderRadius: '14px',
                        textAlign: 'center', border: '2px solid #BBF7D0' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#166534' }}>{availableCount}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16A34A' }}>READY</div>
          </div>
          <div style={{ flex: 1, background: '#FEF2F2', padding: '12px', borderRadius: '14px',
                        textAlign: 'center', border: '2px solid #FECACA' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#991B1B' }}>{deployedCount}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626' }}>DEPLOYED</div>
          </div>
          <div style={{ flex: 1, background: '#FFF7ED', padding: '12px', borderRadius: '14px',
                        textAlign: 'center', border: '2px solid #FED7AA' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#9A3412' }}>{criticalCount}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#EA580C' }}>CRITICAL</div>
          </div>
          <div style={{ flex: 1, background: '#EFF6FF', padding: '12px', borderRadius: '14px',
                        textAlign: 'center', border: '2px solid #BFDBFE' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1E40AF' }}>{volunteers.length}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563EB' }}>TOTAL</div>
          </div>
        </div>

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {[
            { key: 'all',       label: 'All' },
            { key: 'available', label: '🟢 Ready' },
            { key: 'deployed',  label: '🔴 Deployed' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              flex: 1, padding: '10px', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem',
              background: filter === f.key ? 'var(--primary)' : '#F1F5F9',
              color:      filter === f.key ? 'white' : 'var(--text-main)',
              border:     filter === f.key ? 'none' : '2px solid var(--border-color)',
              boxShadow:  filter === f.key ? '0 3px 0 var(--primary-hover)' : '0 2px 0 var(--border-color)',
              marginBottom: 0, cursor: 'pointer',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* ── Map ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Loader2 size={48} className="animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : (
          <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* Live heatmap from crisis DB */}
            {hotspots.length > 0 && <TrueHeatmapLayer hotspots={hotspots} />}

            {/* Crisis zone circles with popups */}
            {hotspots.map(spot => (
              <Circle
                key={`crisis-${spot.id}`}
                center={spot.pos}
                radius={URGENCY_RADIUS[spot.urgency] || 800}
                pathOptions={{
                  color:       URGENCY_COLOR[spot.urgency] || '#3B82F6',
                  fillColor:   URGENCY_COLOR[spot.urgency] || '#3B82F6',
                  fillOpacity: 0.08,
                  weight:      2,
                }}
              >
                <Popup>
                  <div style={{ margin: 0, minWidth: '180px' }}>
                    <strong style={{ fontSize: '1rem', display: 'block', marginBottom: '4px' }}>
                      📍 {spot.location}
                    </strong>
                    <p style={{ margin: '0 0 6px', fontSize: '0.85rem', color: '#475569' }}>
                      {spot.label}
                    </p>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: '20px',
                      background: URGENCY_COLOR[spot.urgency] || '#3B82F6',
                      color: 'white', fontSize: '0.75rem', fontWeight: 700,
                      textTransform: 'uppercase', marginBottom: '4px',
                    }}>
                      {spot.urgency}
                    </span>
                    <br />
                    <span style={{ color: '#64748B', fontSize: '0.8rem' }}>
                      {spot.reports} report{spot.reports !== 1 ? 's' : ''}
                    </span>
                    {spot.timestamp && (
                      <><br /><span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>
                        {new Date(spot.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </span></>
                    )}
                  </div>
                </Popup>
              </Circle>
            ))}

            {/* Volunteer pins */}
            {filteredVols.map(vol => (
              <Marker
                key={vol.id}
                position={vol.pos}
                icon={vol.status === 'available' ? greenPin : (vol.status === 'busy' ? redPin : orangePin)}
              >
                <Popup>
                  <div style={{ margin: 0, minWidth: '160px' }}>
                    <strong style={{ fontSize: '1.1rem' }}>{vol.name}</strong><br />
                    <span style={{
                      color: vol.status === 'available' ? '#16A34A' : '#DC2626',
                      fontWeight: 700,
                    }}>
                      {vol.status === 'available' ? '🟢 Ready to Deploy' : '🔴 Deployed'}
                    </span><br />
                    <span style={{ color: '#475569' }}>{vol.skills}</span><br />
                    <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>📍 {vol.location}</span>
                    {vol.phone && (
                      <><br /><span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>📞 {vol.phone}</span></>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: '16px', left: '16px', zIndex: 1000,
          background: 'white', padding: '12px 16px', borderRadius: '14px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '0.8rem', fontWeight: 600,
          border: '2px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#16A34A', border: '2px solid white', boxShadow: '0 0 0 1px #16A34A' }} />
            Ready to Deploy
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#DC2626', border: '2px solid white', boxShadow: '0 0 0 1px #DC2626' }} />
            Deployed
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: 20, height: 10, borderRadius: '4px', background: 'rgba(220,38,38,0.15)', border: '2px solid #DC2626' }} />
            Critical Zone
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 20, height: 10, borderRadius: '4px', background: 'rgba(215,119,6,0.15)', border: '2px solid #D97706' }} />
            High Zone
          </div>
        </div>
      </div>

      <style>{`
        .leaflet-container { background: #F8FAFC; font-family: inherit; }
        .leaflet-popup-content-wrapper { background: white; color: #0F172A; border: 2px solid #E2E8F0; border-radius: 14px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .leaflet-popup-tip { background: white; }
        .leaflet-popup-content { margin: 14px; line-height: 1.5; }
        .leaflet-container a.leaflet-popup-close-button { color: #94A3B8; font-size: 20px; }
        .leaflet-control-attribution { background: rgba(255,255,255,0.9) !important; color: #94A3B8 !important; font-size: 10px !important; }
      `}</style>
    </div>
  );
}
