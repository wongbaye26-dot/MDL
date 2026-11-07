package cn.emomusic.mobile.widget;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.net.Uri;
import android.util.TypedValue;
import android.widget.RemoteViews;

import java.io.File;

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
    views.setProgressBar(R.id.widget_progress, 1000, progress, false);
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

    views.setImageViewBitmap(R.id.widget_prev_bg, circle(dp(context, wide ? 34 : 40), tonalBg));
    views.setImageViewBitmap(R.id.widget_play_bg, circle(dp(context, wide ? 38 : 44), primary));
    views.setImageViewBitmap(R.id.widget_next_bg, circle(dp(context, wide ? 34 : 40), tonalBg));

    int coverSize = wide ? dp(context, 48) : Math.min(dp(context, 384), 384);
    int coverRadius = wide ? -1 : dp(context, 26);
    Bitmap bitmap = loadCover(pic, coverSize, coverRadius);
    if (bitmap == null) bitmap = fallbackCover(coverSize, coverRadius, title, primary, dark);
    if (bitmap != null) views.setImageViewBitmap(R.id.widget_cover, bitmap);

    Intent open = new Intent().setClassName(PKG, PKG + ".MainActivity");
    open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, wide ? 10 : 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
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

  private static Bitmap loadCover(String pic, int size, int radius) {
    try {
      if (pic == null || pic.isEmpty()) return null;
      String path = pic.startsWith("file://") ? Uri.parse(pic).getPath() : pic;
      if (path == null || !new File(path).exists()) return null;
      Bitmap source = BitmapFactory.decodeFile(path);
      if (source == null) return null;
      Bitmap scaled = Bitmap.createScaledBitmap(source, size, size, true);
      if (radius == 0) return scaled;
      Bitmap rounded = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
      Canvas canvas = new Canvas(rounded);
      Path pathShape = new Path();
      int r = radius < 0 ? size / 2 : radius;
      pathShape.addRoundRect(new RectF(0, 0, size, size), r, r, Path.Direction.CW);
      canvas.clipPath(pathShape);
      canvas.drawBitmap(scaled, 0, 0, new Paint(Paint.FILTER_BITMAP_FLAG));
      return rounded;
    } catch (Exception e) { return null; }
  }
}
