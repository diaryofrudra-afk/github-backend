#!/bin/bash
# Keep Vite alive - restarts if it crashes
cd /Users/rudra/Desktop/Suprwise-complete/reactcodewebapp-main
while true; do
    node node_modules/.bin/vite --host 0.0.0.0 >> /tmp/vite.log 2>&1
    echo "$(date): Vite crashed, restarting in 2s..." >> /tmp/vite.log
    sleep 2
done
