"""
Escorts F23 Safe Load Indicator (SLI) Safety Module
Implements load chart and critical parameter monitoring for F23-ton crawler crane
"""

from enum import Enum
from typing import Optional, Dict, Any
from dataclasses import dataclass


class SafetyLevel(str, Enum):
    """Safety level classifications for SLI monitoring"""
    SAFE = "safe"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class SLINotification:
    """Alert notification for SLI violations"""
    level: str  # "warning" or "critical"
    message: str
    action: str  # recommended action


class EscortsF23SLISafety:
    """
    Escorts F23 Safe Load Indicator Safety Monitor
    
    Specifications:
    - Max boom length: 16.6m
    - Max load capacity: 23 tonnes (varies by boom angle/length)
    - Safe angle range: 0° - 87°
    """
    
    # Load chart: (boom_angle_deg): max_load_at_each_length
    # Format: angle -> {length: max_load}
    LOAD_CHART = {
        0: {5.0: 23.0, 10.0: 13.0, 15.0: 3.5, 16.6: 0.0},
        15: {5.0: 23.0, 10.0: 13.0, 15.0: 4.0, 16.6: 0.5},
        30: {5.0: 22.0, 10.0: 12.0, 15.0: 5.0, 16.6: 1.0},
        45: {5.0: 20.0, 10.0: 11.0, 15.0: 6.0, 16.6: 2.0},
        60: {5.0: 16.0, 10.0: 9.0, 15.0: 5.0, 16.6: 1.5},
        75: {5.0: 10.0, 10.0: 5.0, 15.0: 2.0, 16.6: 0.0},
        87: {5.0: 5.0, 10.0: 2.0, 15.0: 0.5, 16.6: 0.0},
    }
    
    # Critical parameter thresholds
    CRITICAL_THRESHOLDS = {
        'coolant_temp_c': 110,      # °C - critical at >110
        'battery_voltage_v': 30,     # 24V system - critical if >30 or <20
        'battery_voltage_min': 20,
        'urea_level_pct': 100,       # Urea tank - critical if >100 or <5
        'urea_level_min': 5,
        'oil_pressure': 70,           # psi - warning if <70
        'engine_rpm': 3500,           # RPM - warning if >3500
    }
    
    WARNING_THRESHOLDS = {
        'coolant_temp_c': 100,       # °C - warning at >100
        'battery_voltage_v': 28,     # 24V system - warning if >28 or <22
        'battery_voltage_min': 22,
        'urea_level_pct': 95,        # Urea tank - warning if >95 or <10
        'urea_level_min': 10,
        'oil_pressure': 70,          # psi - warning if <70
    }

    @classmethod
    def get_max_load_at_position(cls, boom_length_m: float, boom_angle_deg: float) -> float:
        """
        Calculate maximum safe load for given boom position
        Uses linear interpolation between load chart points
        
        Args:
            boom_length_m: Boom length in meters (0-16.6)
            boom_angle_deg: Boom angle in degrees (0-87)
            
        Returns:
            Maximum safe load in tonnes
        """
        # Clamp values to valid range
        boom_length_m = max(0, min(16.6, boom_length_m))
        boom_angle_deg = max(0, min(87, boom_angle_deg))
        
        # Find angle bracket
        angles = sorted(cls.LOAD_CHART.keys())
        angle_lower = None
        angle_upper = None
        
        for i, angle in enumerate(angles):
            if angle <= boom_angle_deg:
                angle_lower = angle
            if angle >= boom_angle_deg and angle_upper is None:
                angle_upper = angle
        
        if angle_lower is None:
            angle_lower = angles[0]
        if angle_upper is None:
            angle_upper = angles[-1]
        
        # Find length bracket
        lengths = sorted(cls.LOAD_CHART[angle_lower].keys())
        length_lower = None
        length_upper = None
        
        for i, length in enumerate(lengths):
            if length <= boom_length_m:
                length_lower = length
            if length >= boom_length_m and length_upper is None:
                length_upper = length
        
        if length_lower is None:
            length_lower = lengths[0]
        if length_upper is None:
            length_upper = lengths[-1]
        
        # If exact match, return directly
        if (angle_lower == angle_upper or boom_angle_deg == angle_lower) and \
           (length_lower == length_upper or boom_length_m == length_lower):
            return cls.LOAD_CHART[angle_lower][length_lower]
        
        # Bilinear interpolation
        y1 = cls._interpolate_length(
            cls.LOAD_CHART[angle_lower], boom_length_m
        )
        y2 = cls._interpolate_length(
            cls.LOAD_CHART[angle_upper], boom_length_m
        ) if angle_lower != angle_upper else y1
        
        if angle_lower == angle_upper:
            return y1
        
        alpha = (boom_angle_deg - angle_lower) / (angle_upper - angle_lower)
        return y1 * (1 - alpha) + y2 * alpha

    @classmethod
    def _interpolate_length(cls, length_dict: Dict[float, float], length: float) -> float:
        """Linear interpolate load at given length"""
        lengths = sorted(length_dict.keys())
        
        for i, l in enumerate(lengths):
            if l >= length:
                if i == 0:
                    return length_dict[l]
                l_lower = lengths[i-1]
                l_upper = l
                if l_lower == l_upper:
                    return length_dict[l_lower]
                alpha = (length - l_lower) / (l_upper - l_lower)
                return length_dict[l_lower] * (1 - alpha) + length_dict[l_upper] * alpha
        
        return length_dict[lengths[-1]]

    @classmethod
    def evaluate_sli_reading(
        cls,
        boom_length_m: float,
        boom_angle_deg: float,
        load_ton: float,
        coolant_temp_c: Optional[float] = None,
        battery_voltage_v: Optional[float] = None,
        urea_level_pct: Optional[float] = None,
        oil_pressure: Optional[float] = None,
        fuel_rate_lph: Optional[float] = None,
        trans_oil_temp_c: Optional[float] = None,
        hour_meter_h: Optional[float] = None,
        engine_rpm: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Evaluate SLI reading and determine safety level
        
        Args:
            boom_length_m: Boom length in meters
            boom_angle_deg: Boom angle in degrees
            load_ton: Current load in tonnes
            coolant_temp_c: Coolant temperature (°C)
            battery_voltage_v: Battery voltage (V)
            urea_level_pct: Urea level (%)
            oil_pressure: Oil pressure (psi)
            fuel_rate_lph: Fuel consumption rate (LPH)
            trans_oil_temp_c: Transmission oil temperature (°C)
            hour_meter_h: Hour meter reading (hours)
            engine_rpm: Engine RPM
            
        Returns:
            SLI reading dict with safety_level, utilization_percent, and optional notification
        """
        
        # Step 1: Calculate SLI safety from load chart
        max_safe_load = cls.get_max_load_at_position(boom_length_m, boom_angle_deg)
        utilization_percent = (load_ton / max_safe_load * 100) if max_safe_load > 0 else 0
        
        # Determine SLI safety level from utilization
        if load_ton > max_safe_load:
            sli_safety_level = SafetyLevel.CRITICAL
            sli_notification = SLINotification(
                level="critical",
                message=f"⚠️ OVERLOAD: {load_ton}T > {max_safe_load:.1f}T capacity at {boom_length_m}m boom, {boom_angle_deg}deg angle",
                action="Reduce load immediately"
            )
        elif utilization_percent > 90:
            sli_safety_level = SafetyLevel.WARNING
            sli_notification = SLINotification(
                level="warning",
                message=f"⚡ HIGH UTILIZATION: {utilization_percent:.0f}% ({load_ton}T / {max_safe_load:.1f}T max)",
                action="Monitor closely, reduce load gradually"
            )
        else:
            sli_safety_level = SafetyLevel.SAFE
            sli_notification = None
        
        # Step 2: Check critical parameters (can override SLI safety)
        critical_params = []
        warning_params = []
        
        if coolant_temp_c is not None:
            if coolant_temp_c > cls.CRITICAL_THRESHOLDS['coolant_temp_c']:
                critical_params.append(f"Coolant: {coolant_temp_c}°C (>{cls.CRITICAL_THRESHOLDS['coolant_temp_c']})")
            elif coolant_temp_c > cls.WARNING_THRESHOLDS['coolant_temp_c']:
                warning_params.append(f"Coolant: {coolant_temp_c}°C")
        
        if battery_voltage_v is not None:
            if battery_voltage_v > cls.CRITICAL_THRESHOLDS['battery_voltage_v'] or \
               battery_voltage_v < cls.CRITICAL_THRESHOLDS['battery_voltage_min']:
                critical_params.append(f"Battery: {battery_voltage_v}V (unsafe range)")
            elif battery_voltage_v > cls.WARNING_THRESHOLDS['battery_voltage_v'] or \
                 battery_voltage_v < cls.WARNING_THRESHOLDS['battery_voltage_min']:
                warning_params.append(f"Battery: {battery_voltage_v}V")
        
        if urea_level_pct is not None:
            if urea_level_pct > cls.CRITICAL_THRESHOLDS['urea_level_pct'] or \
               urea_level_pct < cls.CRITICAL_THRESHOLDS['urea_level_min']:
                critical_params.append(f"Urea: {urea_level_pct}% (unsafe range)")
            elif urea_level_pct > cls.WARNING_THRESHOLDS['urea_level_pct'] or \
                 urea_level_pct < cls.WARNING_THRESHOLDS['urea_level_min']:
                warning_params.append(f"Urea: {urea_level_pct}%")
        
        if oil_pressure is not None:
            if oil_pressure < cls.WARNING_THRESHOLDS['oil_pressure']:
                if oil_pressure < 50:
                    critical_params.append(f"Oil Pressure: {oil_pressure} psi (critical)")
                else:
                    warning_params.append(f"Oil Pressure: {oil_pressure} psi (low)")
        
        if engine_rpm is not None and engine_rpm > cls.WARNING_THRESHOLDS['engine_rpm']:
            warning_params.append(f"Engine RPM: {engine_rpm} (high)")
        
        # Step 3: Determine final safety level
        final_safety_level = sli_safety_level
        final_notification = sli_notification
        
        if critical_params:
            final_safety_level = SafetyLevel.CRITICAL
            critical_msg = " | ".join(critical_params)
            action = "Immediate shutdown recommended - check engine parameters"
            if final_notification:
                final_notification.level = "critical"
                final_notification.message = f"🚨 CRITICAL PARAMETER: {critical_msg} | {final_notification.message}"
                final_notification.action = action
            else:
                final_notification = SLINotification(
                    level="critical",
                    message=f"🚨 CRITICAL PARAMETER: {critical_msg}",
                    action=action
                )
        elif warning_params and final_safety_level == SafetyLevel.SAFE:
            final_safety_level = SafetyLevel.WARNING
            warning_msg = " | ".join(warning_params)
            final_notification = SLINotification(
                level="warning",
                message=f"⚠️ WARNING PARAMETER: {warning_msg}",
                action="Monitor closely, schedule inspection"
            )
        
        # Build response
        radius_m = cls._calculate_radius(boom_length_m, boom_angle_deg)
        
        return {
            "boom_length_m": boom_length_m,
            "boom_angle_deg": boom_angle_deg,
            "load_ton": load_ton,
            "radius_m": radius_m,
            "max_safe_load_ton": max_safe_load,
            "safety_level": final_safety_level.value,
            "utilization_percent": round(utilization_percent, 1),
            "notification": {
                "level": final_notification.level,
                "message": final_notification.message,
                "action": final_notification.action,
            } if final_notification else None,
            # Optional sensor data (echo back)
            "coolant_temp_c": coolant_temp_c,
            "battery_voltage_v": battery_voltage_v,
            "urea_level_pct": urea_level_pct,
            "oil_pressure": oil_pressure,
            "engine_rpm": engine_rpm,
        }

    @classmethod
    def _calculate_radius(cls, boom_length_m: float, boom_angle_deg: float) -> float:
        """Calculate horizontal reach radius from boom length and angle"""
        import math
        # Assuming boom angle is from horizontal
        angle_rad = math.radians(boom_angle_deg)
        return boom_length_m * math.cos(angle_rad)
