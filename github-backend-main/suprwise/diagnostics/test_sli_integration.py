"""
Test script demonstrating SLI integration with the Escorts F23 crane data
"""

import requests
import json
from datetime import datetime

# Example usage with the provided SLI data
def test_with_sample_data():
    """Test with the sample SLI data provided by the user"""
    
    # Sample data from user's SLI Crane Monitor
    sample_data = {
        "boom_length_m": 0.0,  # Boom Length 0.0 m
        "boom_angle_deg": 0.0, # Angle 0.0°
        "load_ton": 0.00,      # Load 0.00 ton
        "duty_percent": 0.0    # Duty 0.0%
    }
    
    # Also test with some realistic working values
    test_scenarios = [
        {
            "name": "Transport Position",
            "boom_length_m": 2.0,
            "boom_angle_deg": 10.0,
            "load_ton": 0.5,
            "duty_percent": 5.0
        },
        {
            "name": "Near Maximum Reach",
            "boom_length_m": 18.0,
            "boom_angle_deg": 5.0,
            "load_ton": 1.0,
            "duty_percent": 25.0
        },
        {
            "name": "Heavy Lift Close In",
            "boom_length_m": 3.0,
            "boom_angle_deg": 60.0,
            "load_ton": 15.0,
            "duty_percent": 60.0
        },
        {
            "name": "Unsafe - Overload at Max Reach",
            "boom_length_m": 16.6,
            "boom_angle_deg": 0.0,
            "load_ton": 2.0,  # Over the 0.9T limit at this radius
            "duty_percent": 80.0
        }
    ]
    
    print("SLI Safety System Test for Escorts F23 Crane")
    print("=" * 60)
    
    for scenario in test_scenarios:
        print(f"\nScenario: {scenario['name']}")
        print("-" * 40)
        
        # Calculate expected radius for verification
        import math
        radius = scenario["boom_length_m"] * math.cos(math.radians(scenario["boom_angle_deg"]))
        print(f"Boom: {scenario['boom_length_m']}m @ {scenario['boom_angle_deg']}°")
        print(f"Radius: {radius:.1f}m")
        print(f"Load: {scenario['load_ton']}t")
        print(f"Duty: {scenario['duty_percent']}%")
        
        # Here we would normally call the API endpoint:
        # response = requests.post(
        #     "http://localhost:8000/api/diagnostics/sli-evaluate",
        #     json={
        #         "boom_length": scenario["boom_length_m"],
        #         "boom_angle": scenario["boom_angle_deg"],
        #         "load_ton": scenario["load_ton"]
        #     }
        # )
        # result = response.json()
        
        # For demo, we'll simulate the result using our safety calculator
        from suprwise.diagnostics.sli_safety import EscortsF23SLISafety
        safety = EscortsF23SLISafety()
        reading = safety.evaluate_sli_reading(
            scenario["boom_length_m"],
            scenario["boom_angle_deg"],
            scenario["load_ton"]
        )
        notification = safety.get_safety_notification(reading)
        
        print(f"Safe Load Limit: {reading.safe_load_limit:.1f}t")
        print(f"Utilization: {reading.utilization_percent:.0f}%")
        print(f"Safety Level: {reading.safety_level.value.upper()}")
        print(f"Boom Status: {reading.length_status}")
        print(f"Angle Status: {reading.angle_status}")
        print(f"Load Status: {reading.load_status}")
        
        if notification:
            print(f"⚠️  {notification['message']}")
            print(f"💡 {notification['action']}")
        else:
            print("✅ Operating within safe limits")

def demonstrate_api_usage():
    """Show how to integrate with the diagnostics API"""
    print("\n\nAPI Integration Example")
    print("=" * 30)
    print("""
To use this system with your SLI crane monitor:

1. Configure your crane's telemetry system to send SLI data:
   - Boom length (meters)
   - Boom angle (degrees from horizontal)
   - Load weight (tonnes)
   - Optional: Duty cycle percentage

2. Send data to the diagnostics endpoint:
   PUT /api/diagnostics/{crane_registration}
   {
     "sli_boom_length": 15.2,
     "sli_boom_angle": 25.5,
     "sli_load": 3.8,
     "health": "online"
   }

3. Or use the evaluation endpoint for real-time checking:
   POST /api/diagnostics/sli-evaluate
   {
     "boom_length": 15.2,
     "boom_angle": 25.5,
     "load_ton": 3.8
   }

4. The system will:
   - Calculate safe load limits based on boom geometry
   - Determine utilization percentage
   - Assess safety level (safe/warning/danger/critical)
   - Generate appropriate notifications
   - Update equipment health status
   - Store historical data for trend analysis

5. Analytics dashboard will show:
   - Real-time safety status
   - Utilization trends
   - Safety event history
   - Predictive maintenance alerts
""")

if __name__ == "__main__":
    test_with_sample_data()
    demonstrate_api_usage()