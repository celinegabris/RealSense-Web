import math, time
import cv2
import numpy as np
import pyrealsense2 as rs
cv2.startWindowThread()
out = None

def mouse_cb(event, x, y, flags, param):

    if event == cv2.EVENT_LBUTTONDOWN:
        state.mouse_btns[0] = True

    if event == cv2.EVENT_LBUTTONUP:
        state.mouse_btns[0] = False

    if event == cv2.EVENT_RBUTTONDOWN:
        state.mouse_btns[1] = True

    if event == cv2.EVENT_RBUTTONUP:
        state.mouse_btns[1] = False

    if event == cv2.EVENT_MBUTTONDOWN:
        state.mouse_btns[2] = True

    if event == cv2.EVENT_MBUTTONUP:
        state.mouse_btns[2] = False

    if event == cv2.EVENT_MOUSEMOVE:

        h, w = out.shape[:2]
        dx, dy = x - state.prev_mouse[0], y - state.prev_mouse[1]

        if state.mouse_btns[0]:
            state.yaw += float(dx) / w * 2
            state.pitch -= float(dy) / h * 2

        elif state.mouse_btns[1]:
            dp = np.array((dx / w, dy / h, 0), dtype=np.float32)
            state.translation -= np.dot(state.rotation, dp)

        elif state.mouse_btns[2]:
            dz = math.sqrt(dx**2 + dy**2) * math.copysign(0.01, -dy)
            state.translation[2] += dz
            state.distance -= dz

    if event == cv2.EVENT_MOUSEWHEEL:
        dz = math.copysign(0.1, flags)
        state.translation[2] += dz
        state.distance -= dz

    state.prev_mouse = (x, y)




class AppState:

    def __init__(self, *args, **kwargs):
        self.WIN_NAME = 'RealSense'
        self.pitch, self.yaw = 0, 0
        self.translation = np.array([0, 0, -1], dtype=np.float32)
        self.distance = 2
        self.prev_mouse = 0, 0
        self.mouse_btns = [False, False, False]
        self.paused = False
        self.decimate = 1
        self.scale = True
        self.color = False
        self.running = True


    def reset(self):
        self.pitch, self.yaw, self.distance = 0, 0, 2
        self.translation[:] = 0, 0, -1

    @property
    def rotation(self):
        Rx, _ = cv2.Rodrigues((self.pitch, 0, 0))
        Ry, _ = cv2.Rodrigues((0, self.yaw, 0))
        return np.dot(Ry, Rx).astype(np.float32)

    @property
    def pivot(self):
        return self.translation + np.array((0, 0, self.distance), dtype=np.float32)


state = AppState()


def project(v):
    """project 3d vector array to 2d"""
    h, w = out.shape[:2]
    view_aspect = float(h)/w

    # ignore divide by zero for invalid depth
    with np.errstate(divide='ignore', invalid='ignore'):
        proj = v[:, :-1] / v[:, -1, np.newaxis] * \
            (w*view_aspect, h) + (w/2.0, h/2.0)

    # near clipping
    znear = 0.03
    proj[v[:, 2] < znear] = np.nan
    return proj


def view(v):
    """apply view transformation on vector array"""
    return np.dot(v - state.pivot, state.rotation) + state.pivot - state.translation


def pointcloud(out, verts, texcoords, color, painter=True):
    """draw point cloud with optional painter's algorithm"""
    if painter:
        v = view(verts)
        s = v[:, 2].argsort()[::-1]
        proj = project(v[s])
        tex = texcoords[s]
    else:
        proj = project(view(verts))
        tex  = texcoords

    if state.scale:
        proj = proj * (0.5 ** state.decimate)

    h, w = out.shape[:2]

    finite = np.isfinite(proj).all(axis=1)
    if not np.any(finite):
        return  # nothing valid to draw

    proj_f = proj[finite]
    tex_f  = tex[finite]

    j = np.rint(proj_f[:, 0]).astype(np.int32)
    i = np.rint(proj_f[:, 1]).astype(np.int32)

    # Bounds mask on integer indices
    im = (i >= 0) & (i < h)
    jm = (j >= 0) & (j < w)
    m = im & jm
    if not np.any(m):
        return

    cw, ch = color.shape[:2][::-1]
    v_uv, u_uv = (tex_f * (cw, ch) + 0.5).astype(np.int32).T
    # Clip UVs
    np.clip(u_uv, 0, ch - 1, out=u_uv)
    np.clip(v_uv, 0, cw - 1, out=v_uv)

    # Perform uv-mapping
    out[i[m], j[m]] = color[u_uv[m], v_uv[m]]


def run_renderer(rs_manager, device_id):
    pc        = rs.pointcloud()
    decimate  = rs.decimation_filter()
    colorizer = rs.colorizer()
    decimate.set_option(rs.option.filter_magnitude, 2**state.decimate)

    pipeline = rs_manager.pipelines[device_id]
    profile  = pipeline.get_active_profile()
    dprof    = profile.get_stream(rs.stream.depth).as_video_stream_profile()
    w, h     = dprof.get_intrinsics().width, dprof.get_intrinsics().height
    
    global out
    out = np.empty((h, w, 3), dtype=np.uint8)

    cv2.namedWindow(state.WIN_NAME, cv2.WINDOW_AUTOSIZE)
    cv2.resizeWindow(state.WIN_NAME, w, h)
    cv2.setMouseCallback(state.WIN_NAME, mouse_cb)

    while state.running:
        if not state.paused:
            frames    = pipeline.wait_for_frames()
            depth     = decimate.process(frames.get_depth_frame())
            depth_col = np.asanyarray(colorizer.colorize(depth).get_data())

            # try to grab a real color frame, otherwise just colorize the depth
            color_frame = frames.get_color_frame()
            if not color_frame:
                color_img = depth_col
            else:
                color_img = np.asanyarray(color_frame.get_data())

            # choose between “raw color” or “colorized depth” based on your toggle
            if state.color and color_frame:   # only true when a valid color frame exists
                mapped, src = (color_frame, color_img)
            else:
                mapped, src = (depth, depth_col)


            points    = pc.calculate(depth)
            pc.map_to(mapped)
            verts     = np.asanyarray(points.get_vertices()).view(np.float32).reshape(-1,3)
            texcoords = np.asanyarray(points.get_texture_coordinates()).view(np.float32).reshape(-1,2)

            out.fill(0)
            pointcloud(out, verts, texcoords, src, painter=True)
            cv2.imshow(state.WIN_NAME, out)

        key = cv2.waitKey(1)
        if key == ord("r"):
            state.reset()
        elif key == ord("p"):
            state.paused = not state.paused
        elif key == ord("d"):
            state.decimate = (state.decimate + 1) % 3
            decimate.set_option(rs.option.filter_magnitude, 2 ** state.decimate)
        elif key == ord("z"):
            state.scale = not state.scale
        elif key == ord("c"):
            state.color = not state.color
        elif key == ord("s"):
            cv2.imwrite('./out.png', out)
        elif key == ord("e"):
            points.export_to_ply('./out.ply', mapped)
        elif key in (27, ord("q")):
            state.running = False

    cv2.destroyAllWindows()
