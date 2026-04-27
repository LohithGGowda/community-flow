"""
geo.py — Local Geocoding & Distance Service

Provides zero-cost geocoding for the prototype using a hardcoded coordinate
dictionary of Indian cities and Bangalore neighbourhoods.

In production, swap _geocode_lookup() for a Google Maps Geocoding API call.

Public interface:
    geocode(location_str)                    → (lat, lng)
    calculate_distance_km(lat1, lng1, lat2, lng2) → float (km)
    compute_geo_score(distance_km)           → float 0.0–1.0

Design decision: local lookup was chosen over Google Maps API to keep the
prototype zero-cost and zero-credential. The coordinate table covers the
primary NGO deployment areas in Karnataka and major Indian metros.
"""

import math
from typing import Tuple

# ---------------------------------------------------------------------------
# Coordinate lookup table
# Covers Bangalore neighbourhoods + major Indian cities
# ---------------------------------------------------------------------------
_COORDS = {
    # Bangalore neighbourhoods
    "koramangala":      (12.9352, 77.6245),
    "hsr layout":       (12.9121, 77.6446),
    "hsr":              (12.9121, 77.6446),
    "indiranagar":      (12.9784, 77.6408),
    "jayanagar":        (12.9308, 77.5838),
    "rajajinagar":      (12.9911, 77.5546),
    "btm layout":       (12.9166, 77.6101),
    "btm":              (12.9166, 77.6101),
    "basavanagudi":     (12.9434, 77.5712),
    "whitefield":       (12.9698, 77.7500),
    "electronic city":  (12.8440, 77.6568),
    "marathahalli":     (12.9591, 77.6974),
    "hebbal":           (13.0354, 77.5970),
    "yelahanka":        (13.1007, 77.5963),
    "jp nagar":         (12.9102, 77.5850),
    "malleswaram":      (13.0035, 77.5680),
    "shivajinagar":     (12.9850, 77.6010),
    "mg road":          (12.9756, 77.6099),
    "brigade road":     (12.9716, 77.6099),
    "ulsoor":           (12.9830, 77.6200),
    "richmond town":    (12.9630, 77.6010),
    "sadashivanagar":   (13.0050, 77.5750),
    "rt nagar":         (13.0200, 77.5950),
    "nagarbhavi":       (12.9600, 77.5100),
    "kengeri":          (12.9100, 77.4800),
    "bannerghatta":     (12.8600, 77.5900),
    "sarjapur":         (12.8600, 77.7100),
    "kr puram":         (13.0050, 77.6950),
    "cv raman nagar":   (12.9850, 77.6600),
    "domlur":           (12.9600, 77.6400),
    "ejipura":          (12.9500, 77.6300),
    "bommanahalli":     (12.9000, 77.6400),
    "bellandur":        (12.9250, 77.6750),
    "varthur":          (12.9350, 77.7350),
    "kadugodi":         (12.9800, 77.7600),
    "hoodi":            (12.9900, 77.7100),
    "mahadevapura":     (12.9950, 77.7000),
    "brookefield":      (12.9700, 77.7200),
    "kundalahalli":     (12.9750, 77.7050),
    "bangalore":        (12.9716, 77.5946),
    "bengaluru":        (12.9716, 77.5946),
    # Karnataka cities
    "mandya":           (12.5220, 76.8950),
    "mysore":           (12.2958, 76.6394),
    "mysuru":           (12.2958, 76.6394),
    "hubli":            (15.3647, 75.1240),
    "dharwad":          (15.4589, 75.0078),
    "mangalore":        (12.9141, 74.8560),
    "mangaluru":        (12.9141, 74.8560),
    "belgaum":          (15.8497, 74.4977),
    "belagavi":         (15.8497, 74.4977),
    "gulbarga":         (17.3297, 76.8343),
    "kalaburagi":       (17.3297, 76.8343),
    "tumkur":           (13.3379, 77.1173),
    "tumakuru":         (13.3379, 77.1173),
    "shimoga":          (13.9299, 75.5681),
    "shivamogga":       (13.9299, 75.5681),
    "hassan":           (13.0068, 76.1004),
    "davangere":        (14.4644, 75.9218),
    "bellary":          (15.1394, 76.9214),
    "ballari":          (15.1394, 76.9214),
    "bidar":            (17.9104, 77.5199),
    "raichur":          (16.2120, 77.3439),
    "koppal":           (15.3508, 76.1547),
    "gadag":            (15.4166, 75.6278),
    "udupi":            (13.3409, 74.7421),
    "chikmagalur":      (13.3161, 75.7720),
    "kodagu":           (12.4244, 75.7382),
    "coorg":            (12.4244, 75.7382),
    "kolar":            (13.1360, 78.1294),
    "chikkaballapur":   (13.4355, 77.7315),
    "ramanagara":       (12.7157, 77.2817),
    "channapatna":      (12.6510, 77.2080),
    # Major Indian metros
    "chennai":          (13.0827, 80.2707),
    "hyderabad":        (17.3850, 78.4867),
    "mumbai":           (19.0760, 72.8777),
    "delhi":            (28.7041, 77.1025),
    "pune":             (18.5204, 73.8567),
    "kolkata":          (22.5726, 88.3639),
    "ahmedabad":        (23.0225, 72.5714),
    "surat":            (21.1702, 72.8311),
    "jaipur":           (26.9124, 75.7873),
    "lucknow":          (26.8467, 80.9462),
    "kanpur":           (26.4499, 80.3319),
    "nagpur":           (21.1458, 79.0882),
    "indore":           (22.7196, 75.8577),
    "bhopal":           (23.2599, 77.4126),
    "visakhapatnam":    (17.6868, 83.2185),
    "patna":            (25.5941, 85.1376),
    "vadodara":         (22.3072, 73.1812),
    "ghaziabad":        (28.6692, 77.4538),
    "ludhiana":         (30.9010, 75.8573),
    "agra":             (27.1767, 78.0081),
    "nashik":           (19.9975, 73.7898),
    "faridabad":        (28.4089, 77.3178),
    "meerut":           (28.9845, 77.7064),
    "rajkot":           (22.3039, 70.8022),
    "varanasi":         (25.3176, 82.9739),
    "srinagar":         (34.0837, 74.7973),
    "aurangabad":       (19.8762, 75.3433),
    "dhanbad":          (23.7957, 86.4304),
    "amritsar":         (31.6340, 74.8723),
    "navi mumbai":      (19.0330, 73.0297),
    "allahabad":        (25.4358, 81.8463),
    "prayagraj":        (25.4358, 81.8463),
    "ranchi":           (23.3441, 85.3096),
    "howrah":           (22.5958, 88.2636),
    "coimbatore":       (11.0168, 76.9558),
    "jabalpur":         (23.1815, 79.9864),
    "gwalior":          (26.2183, 78.1828),
    "vijayawada":       (16.5062, 80.6480),
    "jodhpur":          (26.2389, 73.0243),
    "madurai":          (9.9252, 78.1198),
    "raipur":           (21.2514, 81.6296),
    "kochi":            (9.9312, 76.2673),
    "cochin":           (9.9312, 76.2673),
    "chandigarh":       (30.7333, 76.7794),
    "thiruvananthapuram": (8.5241, 76.9366),
    "trivandrum":       (8.5241, 76.9366),
    "bhubaneswar":      (20.2961, 85.8245),
    "guwahati":         (26.1445, 91.7362),
    "noida":            (28.5355, 77.3910),
    "gurugram":         (28.4595, 77.0266),
    "gurgaon":          (28.4595, 77.0266),
}

# Default fallback — Bangalore city centre
_DEFAULT = (12.9716, 77.5946)


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def geocode(location_str: str) -> Tuple[float, float]:
    """
    Convert a location string to (lat, lng) coordinates.

    Uses a local lookup table — zero API cost, zero credentials.
    Falls back to Bangalore centre with a tiny random jitter so that
    multiple unknown locations don't stack on the same pixel.

    Args:
        location_str: Any location string, e.g. "HSR Layout, Bangalore"

    Returns:
        (lat, lng) tuple
    """
    if not location_str:
        return _DEFAULT

    lower = location_str.lower().strip()

    # Exact match first
    if lower in _COORDS:
        return _COORDS[lower]

    # Substring match — longest key wins to avoid "bangalore" matching "koramangala, bangalore"
    best_key = None
    best_len = 0
    for key in _COORDS:
        if key in lower and len(key) > best_len:
            best_key = key
            best_len = len(key)

    if best_key:
        return _COORDS[best_key]

    # Unknown location — return default with tiny jitter so pins don't stack
    import random
    return (
        _DEFAULT[0] + (random.random() - 0.5) * 0.06,
        _DEFAULT[1] + (random.random() - 0.5) * 0.06,
    )


def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Haversine formula — great-circle distance between two points on Earth.

    Args:
        lat1, lng1: Coordinates of point 1 (crisis location)
        lat2, lng2: Coordinates of point 2 (volunteer location)

    Returns:
        Distance in kilometres (float)
    """
    R = 6371.0  # Earth radius in km

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def compute_geo_score(distance_km: float, max_radius_km: float = 50.0) -> float:
    """
    Convert a distance in km to a geo score between 0.0 and 1.0.

    Score decays linearly from 1.0 (same location) to 0.0 (at max_radius_km).
    Volunteers beyond max_radius_km still get a score of 0.0 — they are not
    excluded from results, just ranked lower.

    Args:
        distance_km:   Distance between crisis and volunteer
        max_radius_km: Distance at which score reaches 0.0 (default 50 km)

    Returns:
        float 0.0–1.0 (higher = closer)
    """
    if distance_km <= 0:
        return 1.0
    score = 1.0 - (distance_km / max_radius_km)
    return max(0.0, score)
