import socketio
import threading

from app.services.pointcloud_renderer import run_renderer, state as renderer_state

# Create Socket.IO Server
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins='*')

# Setup basic event handlers
@sio.event
async def connect(sid, environ):
    print(f"Socket.IO client connected: {sid}")
    await sio.emit('welcome', {'message': 'Connected to RealSense Metadata Server'}, to=sid)

@sio.event
async def disconnect(sid):
    print(f"Socket.IO client disconnected: {sid}")


# Client will emit {"device_id": "...", "enabled": true/false}
@sio.on("toggle_3d")
async def toggle_3d(sid, data):
    device_id = data.get("device_id")
    enabled   = bool(data.get("enabled"))
    # rs_manager = get_realsense_manager()
    from app.api.dependencies import get_realsense_manager
    rs_manager = get_realsense_manager()


    if enabled:
        # start the OpenCV renderer in a background thread
        renderer_state.running = True
        threading.Thread(
            target=run_renderer,
            args=(rs_manager, device_id),
            daemon=True
        ).start()
    else:
        # signal the loop to exit and close the window
        renderer_state.running = False