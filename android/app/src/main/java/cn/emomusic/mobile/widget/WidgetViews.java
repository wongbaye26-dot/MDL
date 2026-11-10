package cn.emomusic.mobile.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.TypedValue;
import android.widget.RemoteViews;

import cn.emomusic.mobile.R;

final class WidgetViews {
  private static final String PKG = "cn.emomusic.mobile";

  static RemoteViews build(Context context, boolean wide) {
    SharedPreferences prefs = context.getSharedPreferences(WidgetModule.PREFS, Context.MODE_PRIVATE);
    String title = prefs.getString("title", "Emo 音乐");
    String singer = prefs.getString("singer", "未在播放");
    boolean playing = prefs.getBoolean("playing", false);
    boolean dark = prefs.getBoolean("dark", true);
    String pic = prefs.getString("pic", "");
    String lyric = prefs.getString("lyric", "");
    String primaryHex = prefs.getString("primary", "#6C5CE7");
    int primary;
    try { primary = Color.parseColor(primaryHex); } catch (Exception e) { primary = 0xFF6C5CE7; }
    int onPrimary = luminance(primary) > 0.55 ? 0xFF1A1420 : 0xFFFFFFFF;
    int tonalBg = (primary & 0x00FFFFFF) | (dark ? 0x33 : 0x22) << 24;
    int progress = prefs.getInt("progress", 0);

    RemoteViews views = new RemoteViews(context.getPackageName(), wide ? R.layout.widget_music_wide : R.layout.widget_music_small);
    views.setTextViewText(R.id.widget_title, title == null || title.isEmpty() ? "Emo 音乐" : title);
    views.setTextViewText(R.id.widget_singer, singer == null || singer.isEmpty() ? "未在播放" : singer);
    views.setImageViewResource(R.id.widget_play, playing ? R.drawable.widget_pause : R.drawable.widget_play);
    boolean darkIcons = !wide || !dark;
    views.setImageViewResource(R.id.widget_prev, darkIcons ? R.drawable.widget_prev_dark : R.drawable.widget_prev);
    views.setImageViewResource(R.id.widget_next, darkIcons ? R.drawable.widget_next_dark : R.drawable.widget_next);

    int textColor = wide ? (dark ? 0xFFFFFFFF : 0xFF1A1420) : 0xFFFFFFFF;
    int subColor = wide ? (dark ? 0xCCFFFFFF : 0x99000000) : 0xCCFFFFFF;
    if (wide) views.setProgressBar(R.id.widget_progress, 1000, progress, false);
    views.setTextColor(R.id.widget_title, textColor);
    views.setTextColor(R.id.widget_singer, subColor);
    if (wide) {
      if (lyric == null || lyric.isEmpty()) {
        views.setViewVisibility(R.id.widget_lyric, android.view.View.GONE);
      } else {
        views.setViewVisibility(R.id.widget_lyric, android.view.View.VISIBLE);
        views.setTextViewText(R.id.widget_lyric, lyric);
        views.setTextColor(R.id.widget_lyric, primary);
      }
    }

    if (wide) {
      views.setInt(R.id.widget_root, "setBackgroundResource", dark ? R.drawable.widget_bg_glass_dark : R.drawable.widget_bg_glass_light);
    } else {
      views.setInt(R.id.widget_root, "setBackgroundResource", dark ? R.drawable.widget_bg_glass_dark : R.drawable.widget_bg_glass_light);
      views.setInt(R.id.widget_scrim, "setBackgroundResource", dark ? R.drawable.widget_scrim : R.drawable.widget_scrim_light);
    }

    views.setImageViewBitmap(R.id.widget_prev_bg, circle(dp(context, wide ? 34 : 30), tonalBg));
    views.setImageViewBitmap(R.id.widget_play_bg, circle(dp(context, wide ? 38 : 36), primary));
    views.setImageViewBitmap(R.id.widget_next_bg, circle(dp(context, wide ? 34 : 30), tonalBg));

    int coverSize = wide ? dp(context, 48) : Math.min(dp(context, 384), 384);
    int coverRadius = wide ? -1 : dp(context, 26);
    Bitmap bitmap = loadCover(context, pic, coverSize, coverRadius);
    if (bitmap == null) bitmap = fallbackCover(coverSize, coverRadius, title, primary, dark);
    if (bitmap != null) views.setImageViewBitmap(R.id.widget_cover, bitmap);
    // 在线歌曲的封面是 http(s) 地址，第一次渲染时磁盘缓存里还没有：
    // 先用占位图顶上，后台下完再让小组件自己重绘一次。
    if (WidgetCover.isRemote(pic) && !WidgetCover.isCached(context, pic)) {
      final Context app = context.getApplicationContext();
      WidgetCover.prefetch(app, pic, () -> {
        AppWidgetManager manager = AppWidgetManager.getInstance(app);
        MusicWidgetSmallProvider.updateAll(app, manager);
        MusicWidgetWideProvider.updateAll(app, manager);
      });
    }

    Intent open = new Intent().setClassName(PKG, PKG + ".MainActivity");
    open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, wide ? 10 : 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

    // 封面单独开一个深链：点封面直达播放器页（emomusic://player/open）
    Intent openPlayer = new Intent(Intent.ACTION_VIEW, Uri.parse("emomusic://player/open"))
        .setClassName(PKG, PKG + ".MainActivity")
        .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    PendingIntent openPlayerIntent = PendingIntent.getActivity(context, wide ? 20 : 21, openPlayer, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    views.setOnClickPendingIntent(R.id.widget_cover, openPlayerIntent);
    if (!wide) {
      // 小尺寸布局里 widget_scrim 盖在封面上面（纯装饰、本身不接收点击），
      // 不把点击挂到它身上，点封面区域会一路冒泡到 root，变成「回首页」
      views.setOnClickPendingIntent(R.id.widget_scrim, openPlayerIntent);
    }
    views.setOnClickPendingIntent(R.id.widget_play, broadcast(context, wide ? 11 : 1, WidgetActionReceiver.ACTION_TOGGLE));
    views.setOnClickPendingIntent(R.id.widget_next, broadcast(context, wide ? 12 : 2, WidgetActionReceiver.ACTION_NEXT));
    views.setOnClickPendingIntent(R.id.widget_prev, broadcast(context, wide ? 13 : 3, WidgetActionReceiver.ACTION_PREV));
    return views;
  }

  private static int dp(Context context, int value) {
    return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, context.getResources().getDisplayMetrics()));
  }

  static Bitmap circle(int size, int color) {
    Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
    Canvas canvas = new Canvas(bitmap);
    Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    paint.setColor(color);
    canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
    return bitmap;
  }

  private static double luminance(int color) {
    return (0.299 * Color.red(color) + 0.587 * Color.green(color) + 0.114 * Color.blue(color)) / 255.0;
  }

  private static PendingIntent broadcast(Context context, int code, String action) {
    Intent intent = new Intent(context, WidgetActionReceiver.class).setAction(action);
    return PendingIntent.getBroadcast(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  private static Bitmap fallbackCover(int size, int radius, String title, int primary, boolean dark) {
    try {
      Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
      Canvas canvas = new Canvas(bitmap);
      Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
      paint.setColor(dark ? primary : (primary & 0x00FFFFFF) | 0x33000000);
      if (radius < 0) canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
      else canvas.drawRoundRect(new RectF(0, 0, size, size), radius, radius, paint);
      String label = title == null || title.isEmpty() ? "Emo" : title.substring(0, 1);
      Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
      text.setColor(dark ? 0xFFFFFFFF : 0xFF1A1420);
      text.setTextSize(size * 0.38f);
      text.setTextAlign(Paint.Align.CENTER);
      Paint.FontMetrics metrics = text.getFontMetrics();
      float baseline = size / 2f - (metrics.ascent + metrics.descent) / 2f;
      canvas.drawText(label, size / 2f, baseline, text);
      return bitmap;
    } catch (Exception e) { return null; }
  }

  /**
   * 封面：本地路径 / file:// 直接解码，在线 http(s) 走 WidgetCover 的磁盘缓存。
   * 旧实现只认本地文件，在线歌曲因此一直显示首字占位图。
   */
  private static Bitmap loadCover(Context context, String pic, int size, int radius) {
    return WidgetCover.cover(context, pic, size, radius);
  }
}
