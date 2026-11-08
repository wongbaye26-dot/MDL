package cn.emomusic.mobile.blur;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Build;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;

/**
 * 自研高斯模糊 View（替代 @react-native-community/blur）。
 *
 * 背景：RN 0.80 新架构下 RNN 8.6.2 自带 BlurView 3.0.0，而 community blur 4.4.1 的
 * Fabric 实现是按 BlurView 2.0.4 编译的，两者 API 冲突。BlurView 3 的 BlurTarget
 * 方案要求「被模糊的内容」和「BlurView」是兄弟节点，意味着每个页面都要重排布局。
 *
 * 这里换成 v2 的思路：View 自己在 preDraw 时把窗口内容画进自己的小 bitmap
 * （用 marker canvas 跳过所有 GlassBlurView，避免递归/自模糊），
 * 再用 RenderEffect（API 31+）做硬件高斯模糊后绘制到自己身上。
 * 对 JS 侧完全透明：仍然是「绝对定位的玻璃层」，不改页面布局。
 */
public class GlassBlurView extends View {

  /** 把窗口内容画进快照时用的标记 Canvas：GlassBlurView 看到它就把自己跳过 */
  static final class SnapshotCanvas extends Canvas {
    SnapshotCanvas(Bitmap bitmap) {
      super(bitmap);
    }
  }

  private final Paint bitmapPaint = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.DITHER_FLAG);
  private final int[] rootLocation = new int[2];
  private final int[] selfLocation = new int[2];

  private float blurRadius = 18f;
  private int overlayColor = Color.TRANSPARENT;
  private boolean blurEnabled = true;

  /** 快照缩放：0.55 在视觉与开销之间取平衡（RenderEffect 会再降采样） */
  private static final float SNAPSHOT_SCALE = 0.30f;

  /** 静止时低帧率更新；滚动/动画刚发生时临时提高更新频率（避免 UI 线程被快照打满） */
  private static final long IDLE_INTERVAL_MS = 260L;
  private static final long ACTIVE_INTERVAL_MS = 50L;
  private static final long ACTIVE_WINDOW_MS = 420L;

  private Bitmap snapshot;
  private Canvas snapshotCanvas;
  private long lastCaptureAt;
  private long lastScrollAt;
  private boolean scrollListenerRegistered;
  private ViewGroup rootView;
  /** 当前快照的软件模糊结果（每帧只 drawBitmap，不在 RenderThread 里重复跑 RenderEffect） */
  private Bitmap blurred;
  private final RectF dstRect = new RectF();

  private final ViewTreeObserver.OnScrollChangedListener scrollListener = new ViewTreeObserver.OnScrollChangedListener() {
    @Override
    public void onScrollChanged() {
      // 滚动中的内容变化最需要及时模糊；其它时间（转盘呼吸/自转等）降低刷新频率省电
      lastScrollAt = System.currentTimeMillis();
    }
  };

  private final ViewTreeObserver.OnPreDrawListener preDrawListener = new ViewTreeObserver.OnPreDrawListener() {
    @Override
    public boolean onPreDraw() {
      updateSnapshot();
      return true;
    }
  };

  public GlassBlurView(Context context) {
    super(context);
  }

  public void setBlurRadius(float radius) {
    float next = Math.max(0f, Math.min(25f, radius));
    if (next == blurRadius) return;
    blurRadius = next;
    // 半径变了：下一帧先重新抓快照并重算软件模糊
    lastCaptureAt = 0L;
    invalidate();
  }

  public void setOverlayColor(int color) {
    if (overlayColor == color) return;
    overlayColor = color;
    invalidate();
  }

  public void setBlurEnabled(boolean enabled) {
    if (blurEnabled == enabled) return;
    blurEnabled = enabled;
    if (!enabled) {
      unregister();
      releaseBitmap();
    } else {
      register();
      invalidate();
    }
  }

  @Override
  protected void onAttachedToWindow() {
    super.onAttachedToWindow();
    View root = getRootView();
    if (root instanceof ViewGroup) {
      rootView = (ViewGroup) root;
    }
    register();
  }

  @Override
  protected void onDetachedFromWindow() {
    unregister();
    releaseBitmap();
    super.onDetachedFromWindow();
  }

  @Override
  protected void onSizeChanged(int w, int h, int oldw, int oldh) {
    super.onSizeChanged(w, h, oldw, oldh);
    releaseBitmap();
  }

  private void register() {
    if (rootView != null && blurEnabled) {
      ViewTreeObserver observer = rootView.getViewTreeObserver();
      observer.addOnPreDrawListener(preDrawListener);
      if (!scrollListenerRegistered) {
        observer.addOnScrollChangedListener(scrollListener);
        scrollListenerRegistered = true;
      }
      postInvalidateOnAnimation();
    }
  }

  private void unregister() {
    if (rootView != null) {
      ViewTreeObserver observer = rootView.getViewTreeObserver();
      if (observer.isAlive()) {
        observer.removeOnPreDrawListener(preDrawListener);
        if (scrollListenerRegistered) {
          observer.removeOnScrollChangedListener(scrollListener);
          scrollListenerRegistered = false;
        }
      }
    }
  }

  private void releaseBitmap() {
    if (snapshot != null) {
      snapshot.recycle();
      snapshot = null;
      snapshotCanvas = null;
    }
    if (blurred != null) {
      blurred.recycle();
      blurred = null;
    }
  }

  private boolean ensureBitmap() {
    int width = getWidth();
    int height = getHeight();
    if (width <= 0 || height <= 0) return false;
    int bw = Math.max(1, Math.round(width * SNAPSHOT_SCALE));
    int bh = Math.max(1, Math.round(height * SNAPSHOT_SCALE));
    if (snapshot == null || snapshot.getWidth() != bw || snapshot.getHeight() != bh) {
      releaseBitmap();
      try {
        snapshot = Bitmap.createBitmap(bw, bh, Bitmap.Config.ARGB_8888);
      } catch (OutOfMemoryError e) {
        snapshot = null;
        return false;
      }
      snapshotCanvas = new SnapshotCanvas(snapshot);
    }
    return snapshot != null && snapshotCanvas != null;
  }

  private void updateSnapshot() {
    if (!blurEnabled || !isShown() || rootView == null) return;
    long now = System.currentTimeMillis();
    long interval = now - lastScrollAt < ACTIVE_WINDOW_MS ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
    if (now - lastCaptureAt < interval) return;
    if (!ensureBitmap()) return;
    lastCaptureAt = now;

    int width = getWidth();
    int height = getHeight();
    float scaleX = (float) snapshot.getWidth() / width;
    float scaleY = (float) snapshot.getHeight() / height;

    rootView.getLocationOnScreen(rootLocation);
    getLocationOnScreen(selfLocation);
    float left = selfLocation[0] - rootLocation[0];
    float top = selfLocation[1] - rootLocation[1];

    snapshot.eraseColor(Color.TRANSPARENT);
    snapshotCanvas.save();
    // 把「窗口内容」平移到本 View 的位置，再缩放到快照尺寸
    snapshotCanvas.translate(-left * scaleX, -top * scaleY);
    snapshotCanvas.scale(scaleX, scaleY);
    try {
      rootView.draw(snapshotCanvas);
    } catch (Exception ignored) {
      // 某些系统 View 在软件 Canvas 上可能抛异常，保留上一帧快照即可
    }
    snapshotCanvas.restore();

    applySoftwareBlur();
  }

  @Override
  public void draw(Canvas canvas) {
    // 正在为快照绘制窗口内容：跳过自己（含其它玻璃层），避免递归/自模糊
    if (canvas instanceof SnapshotCanvas) return;
    if (!blurEnabled || !isShown()) return;

    if (blurred != null) {
      dstRect.set(0, 0, getWidth(), getHeight());
      canvas.drawBitmap(blurred, null, dstRect, bitmapPaint);
    } else if (overlayColor == Color.TRANSPARENT) {
      canvas.drawColor(0x33000000);
      return;
    }
    if (overlayColor != Color.TRANSPARENT) canvas.drawColor(overlayColor);
  }

  /**
   * 软件 box blur（3 次迭代近似高斯），在快照更新时算一次并把结果缓存成 bitmap。
   *
   * 之前用 RenderEffect 在 RenderNode 里每帧模糊，RenderThread 每帧都要跑一次 GPU blur
   * （实测 RenderThread 占 ~50% CPU）。改成「更新时软件模糊一次 + 每帧只画缓存 bitmap」后，
   * RenderThread 每帧只剩一次普通贴图，播放/转盘动画时 CPU 明显下降。
   */
  private void applySoftwareBlur() {
    int w = snapshot.getWidth();
    int h = snapshot.getHeight();
    int radius = Math.max(1, Math.round(blurRadius * SNAPSHOT_SCALE * 1.6f));

    if (blurred == null || blurred.getWidth() != w || blurred.getHeight() != h) {
      if (blurred != null) blurred.recycle();
      blurred = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
    }

    int[] src = new int[w * h];
    snapshot.getPixels(src, 0, w, 0, 0, w, h);
    int[] tmp = new int[w * h];
    for (int i = 0; i < 3; i++) {
      boxBlurHorizontal(src, tmp, w, h, radius);
      boxBlurVertical(tmp, src, w, h, radius);
    }
    blurred.setPixels(src, 0, w, 0, 0, w, h);
  }

  private static void boxBlurHorizontal(int[] src, int[] dst, int w, int h, int radius) {
    int div = radius * 2 + 1;
    for (int y = 0; y < h; y++) {
      int row = y * w;
      int r = 0, g = 0, b = 0, a = 0;
      for (int i = -radius; i <= radius; i++) {
        int px = src[row + Math.max(0, Math.min(w - 1, i))];
        a += (px >>> 24) & 0xff;
        r += (px >> 16) & 0xff;
        g += (px >> 8) & 0xff;
        b += px & 0xff;
      }
      for (int x = 0; x < w; x++) {
        dst[row + x] = ((a / div) << 24) | ((r / div) << 16) | ((g / div) << 8) | (b / div);
        int addX = Math.min(w - 1, x + radius + 1);
        int subX = Math.max(0, x - radius);
        int addPx = src[row + addX];
        int subPx = src[row + subX];
        a += ((addPx >>> 24) & 0xff) - ((subPx >>> 24) & 0xff);
        r += ((addPx >> 16) & 0xff) - ((subPx >> 16) & 0xff);
        g += ((addPx >> 8) & 0xff) - ((subPx >> 8) & 0xff);
        b += (addPx & 0xff) - (subPx & 0xff);
      }
    }
  }

  private static void boxBlurVertical(int[] src, int[] dst, int w, int h, int radius) {
    int div = radius * 2 + 1;
    for (int x = 0; x < w; x++) {
      int r = 0, g = 0, b = 0, a = 0;
      for (int i = -radius; i <= radius; i++) {
        int px = src[Math.max(0, Math.min(h - 1, i)) * w + x];
        a += (px >>> 24) & 0xff;
        r += (px >> 16) & 0xff;
        g += (px >> 8) & 0xff;
        b += px & 0xff;
      }
      for (int y = 0; y < h; y++) {
        dst[y * w + x] = ((a / div) << 24) | ((r / div) << 16) | ((g / div) << 8) | (b / div);
        int addY = Math.min(h - 1, y + radius + 1);
        int subY = Math.max(0, y - radius);
        int addPx = src[addY * w + x];
        int subPx = src[subY * w + x];
        a += ((addPx >>> 24) & 0xff) - ((subPx >>> 24) & 0xff);
        r += ((addPx >> 16) & 0xff) - ((subPx >> 16) & 0xff);
        g += ((addPx >> 8) & 0xff) - ((subPx >> 8) & 0xff);
        b += (addPx & 0xff) - (subPx & 0xff);
      }
    }
  }
}
