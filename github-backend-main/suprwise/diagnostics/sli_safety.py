"""
SLI Safety System for Escorts F23 Crane
Calculates safe operating envelope and provides real-time alerts
"""

import math
from typing import Dict, Tuple, Optional
from dataclasses import dataclass
from enum import Enum

class SafetyLevel(Enum):
    SAFE = "safe"
    WARNING = "warning"
    DANGER = "danger"
    CRITICAL = "critical"

@dataclass
class SLIReading:
    boom_length_m: float  # meters
    boom_angle_deg: float  # degrees from horizontal
    load_ton: float       # tonnes
    radius_m: float       # horizontal distance from center to load
    duty_percent: float   # duty cycle %
    angle_status: str     # "normal", "approaching_limit", "limit_exceeded"
    length_status: str    # "retracted", "partial", "extended", "overextended"
    load_status: str      # "none", "light", "medium", "heavy", "overload"
    safety_level: SafetyLevel
    safe_load_limit: float  # maximum safe load for current config (tonnes)
    load_moment: float    # load * radius (tonne-meters)
    safe_load_moment: float # maximum safe load moment (tonne-meters)
    utilization_percent: float  # (actual load moment / safe load moment) * 100

class EscortsF23SLISafety:
    """
    Safety system for Escorts F23 crane based on known specifications:
    - Max lifting capacity: 23 tonnes at 1.5m radius
    - Capacity at max radius: 0.9 tonnes at 16.6m radius
    - Boom luffing range: -3° to +65°
    - Standard boom length: 20.1m
    - Max height with jib: 22.3m
    """
    
    def __init__(self):
        # Crane specifications from Escorts F23 documentation
        self.max_boom_length = 20.1  # meters (standard boom)
        self.max_boom_length_with_jib = 22.3  # meters
        self.min_boom_angle = -3.0   # degrees
        self.max_boom_angle = 65.0   # degrees
        
        # Load capacity points (radius -> capacity in tonnes)
        self.load_chart = {
            1.5: 23.0,   # 23T at 1.5m radius
            16.6: 0.9    # 0.9T at 16.6m radius
        }
        
        # Safety thresholds
        self.warning_threshold = 0.8   # 80% of safe limit
        self.danger_threshold = 0.95   # 95% of safe limit
        self.critical_threshold = 1.0  # 100% of safe limit
        
        # Angle safety margins
        self.angle_warning_margin = 5.0   # degrees from limit
        
    def _interpolate_load_capacity(self, radius: float) -> float:
        """
        Interpolate load capacity based on radius using the two known points.
        Uses inverse relationship: capacity ∝ 1/radius (simplified load moment)
        """
        if radius <= self.load_chart[1.5]:
            return self.load_chart[1.5]
        if radius >= self.load_chart[16.6]:
            return self.load_chart[16.6]
            
        # Linear interpolation in log space for better accuracy
        r1, c1 = 1.5, self.load_chart[1.5]
        r2, c2 = 16.6, self.load_chart[16.6]
        
        # Load moment should be roughly constant: load * radius = constant
        # So capacity = k / radius
        k1 = c1 * r1
        k2 = c2 * r2
        k = k1 + (k2 - k1) * ((radius - r1) / (r2 - r1))
        
        return k / radius
    
    def _calculate_radius(self, boom_length: float, angle_deg: float) -> float:
        """Calculate horizontal radius from boom length and angle"""
        if boom_length <= 0:
            return 0.0
        angle_rad = math.radians(angle_deg)
        return boom_length * math.cos(angle_rad)
    
    def _assess_boom_length(self, length: float) -> str:
        """Assess boom extension status"""
        if length <= 0.1:
            return "retracted"
        elif length < self.max_boom_length * 0.3:
            return "partial"
        elif length < self.max_boom_length * 0.7:
            return "extended"
        elif length <= self.max_boom_length:
            return "fully_extended"
        else:
            return "overextended"
    
    def _assess_boom_angle(self, angle: float) -> Tuple[str, SafetyLevel]:
        """Assess boom angle safety"""
        if angle < self.min_boom_angle:
            return ("below_min_limit", SafetyLevel.CRITICAL)
        if angle > self.max_boom_angle:
            return ("above_max_limit", SafetyLevel.CRITICAL)
            
        # Check warning margins
        if angle < (self.min_boom_angle + self.angle_warning_margin):
            return ("approaching_min_limit", SafetyLevel.WARNING)
        if angle > (self.max_boom_angle - self.angle_warning_margin):
            return ("approaching_max_limit", SafetyLevel.WARNING)
            
        return ("normal", SafetyLevel.SAFE)
    
    def _assess_load_status(self, load: float, safe_limit: float) -> str:
        """Assess load level relative to safe limit"""
        if load <= 0.1:
            return "none"
        elif load < safe_limit * 0.25:
            return "light"
        elif load < safe_limit * 0.5:
            return "medium"
        elif load < safe_limit * 0.8:
            return "heavy"
        elif load < safe_limit:
            return "near_capacity"
        else:
            return "overload"
    
    def evaluate_sli_reading(self, boom_length_m: float, boom_angle_deg: float, 
                           load_ton: float) -> SLIReading:
        """
        Evaluate SLI reading and return safety assessment
        """
        # Calculate radius
        radius_m = self._calculate_radius(boom_length_m, boom_angle_deg)
        
        # Get safe load capacity for this radius
        safe_load_limit = self._interpolate_load_capacity(radius_m)
        
        # Calculate load moment (simplified as load * radius)
        load_moment = load_ton * radius_m
        safe_load_moment = safe_load_limit * radius_m
        
        # Calculate utilization percentage
        if safe_load_moment > 0:
            utilization_percent = (load_moment / safe_load_moment) * 100
        else:
            utilization_percent = 0.0
            
        # Assess boom length status
        length_status = self._assess_boom_length(boom_length_m)
        
        # Assess boom angle status and safety level from angle
        angle_status, angle_safety = self._assess_boom_angle(boom_angle_deg)
        
        # Assess load status
        load_status = self._assess_load_status(load_ton, safe_load_limit)
        
        # Determine overall safety level
        safety_level = SafetyLevel.SAFE
        
        # Check for overload
        if utilization_percent >= self.critical_threshold * 100:
            safety_level = SafetyLevel.CRITICAL
        elif utilization_percent >= self.danger_threshold * 100:
            safety_level = SafetyLevel.DANGER
        elif utilization_percent >= self.warning_threshold * 100:
            safety_level = SafetyLevel.WARNING
        # Check angle safety (could override load-based safety)
        elif angle_safety.value in ["warning", "danger", "critical"]:
            # Map angle safety to overall safety level
            if angle_safety == SafetyLevel.CRITICAL:
                safety_level = SafetyLevel.CRITICAL
            elif angle_safety == SafetyLevel.DANGER:
                safety_level = SafetyLevel.DANGER
            elif angle_safety == SafetyLevel.WARNING and safety_level == SafetyLevel.SAFE:
                safety_level = SafetyLevel.WARNING
                
        return SLIReading(
            boom_length_m=boom_length_m,
            boom_angle_deg=boom_angle_deg,
            load_ton=load_ton,
            radius_m=radius_m,
            duty_percent=0.0,  # Would come from separate SLI duty reading
            angle_status=angle_status,
            length_status=length_status,
            load_status=load_status,
            safety_level=safety_level,
            safe_load_limit=safe_load_limit,
            load_moment=load_moment,
            safe_load_moment=safe_load_moment,
            utilization_percent=utilization_percent
        )
    
    def get_safety_notification(self, reading: SLIReading) -> Optional[Dict]:
        """
        Generate notification message if safety action is needed
        """
        if reading.safety_level == SafetyLevel.SAFE:
            return None
            
        messages = {
            SafetyLevel.WARNING: f"⚠️ WARNING: Crane operating at {reading.utilization_percent:.0f}% capacity",
            SafetyLevel.DANGER: f"🚨 DANGER: Crane at {reading.utilization_percent:.0f}% capacity - reduce load immediately",
            SafetyLevel.CRITICAL: f"🛑 CRITICAL: Exceeding safe limits! Load: {reading.load_ton}T @ {reading.radius_m:.1f}m radius"
        }
        
        # Add angle-specific warnings
        if "approaching" in reading.angle_status:
            msg = messages.get(reading.safety_level, "Check crane configuration")
            return {
                "level": reading.safety_level.value,
                "message": f"{msg} | Boom angle: {reading.boom_angle_deg}° (limit: {self.min_boom_angle}° to {self.max_boom_angle}°)",
                "action": "Monitor boom angle and reduce extension if needed"
            }
        elif "limit" in reading.angle_status:
            return {
                "level": reading.safety_level.value,
                "message": f"🚨 BOOM ANGLE LIMIT EXCEEDED: {reading.boom_angle_deg}° (safe range: {self.min_boom_angle}° to {self.max_boom_angle}°)",
                "action": "Adjust boom angle immediately to prevent tipping"
            }
        elif reading.length_status == "overextended":
            return {
                "level": "critical",
                "message": f"🚨 BOOM OVEREXTENDED: {reading.boom_length_m}m (max: {self.max_boom_length}m)",
                "action": "Retract boom immediately"
            }
        else:
            return {
                "level": reading.safety_level.value,
                "message": messages.get(reading.safety_level, "Check crane operation"),
                "action": "Reduce load or adjust boom configuration"
            }

# Example usage and test function
def test_sli_safety():
    """Test the SLI safety system with sample data"""
    safety = EscortsF23SLISafety()
    
    # Test cases
    test_cases = [
        # (boom_length, angle, load, description)
        (0.0, 0.0, 0.0, "Boom retracted, no load"),
        (5.0, 30.0, 5.0, "Partial extension, moderate load"),
        (15.0, 10.0, 2.0, "Near max radius, light load"),
        (20.1, 5.0, 0.5, "Max boom, very light load (should be safe)"),
        (20.1, 5.0, 1.0, "Max boom, moderate load"),
        (20.1, 0.0, 0.9, "Max radius, max capacity (0.9T at 16.6m)"),
        (1.5, 60.0, 20.0, "Short boom, high angle, near capacity"),
        (20.1, 70.0, 1.0, "Over maximum angle"),
        (25.0, 10.0, 1.0, "Overextended boom"),
    ]
    
    print("Escorts F23 SLI Safety System Test")
    print("=" * 50)
    
    for length, angle, load, desc in test_cases:
        reading = safety.evaluate_sli_reading(length, angle, load)
        notification = safety.get_safety_notification(reading)
        
        print(f"\n{desc}")
        print(f"  Boom: {reading.boom_length_m:.1f}m @ {reading.boom_angle_deg:.1f}°")
        print(f"  Load: {reading.load_ton:.1f}T @ radius {reading.radius_m:.1f}m")
        print(f"  Safe limit: {reading.safe_load_limit:.1f}T")
        print(f"  Utilization: {reading.utilization_percent:.0f}%")
        print(f"  Status: {reading.safety_level.value.upper()}")
        print(f"  Length: {reading.length_status}")
        print(f"  Angle: {reading.angle_status}")
        
        if notification:
            print(f"  ⚠️  {notification['message']}")
            print(f"  💡 Action: {notification['action']}")

if __name__ == "__main__":
    test_sli_safety()