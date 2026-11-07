package cn.emomusic.mobile.widget;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.net.Uri;
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

    RemoteViews views = new RemoteViews(context.getPackageName(), wide ? R.layout.widget_music_wide : R.layout.widget_music_small);
    views.setTextViewText(R.id.widget_title, title == null || title.isEmpty() ? "Emo 音乐" : title);
    views.setTextViewText(R.id.widget_singer, singer == null || singer.isEmpty() ? "未在播放" : singer);
    views.setImageViewResource(R.id.widget_play, playing ? R.drawable.widget_pause : R.drawable.widget_play);
    if (wide) views.setInt(R.id.widget_root, "setBackgroundResource", dark ? R.drawable.widget_bg_dark : R.drawable.widget_bg_light);
    int textColor = dark ? 0xFFFFFFFF : 0xFF1A1420;
    int subColor = dark ? 0xCCFFFFFF : 0x99000000;
    views.setTextColor(R.id.widget_title, textColor);
    views.setTextColor(R.id.widget_singer, subColor);
    for (int id : new int[]{R.id.widget_prev, R.id.widget_play, R.id.widget_next}) {
      views.setInt(id, "setBackgroundResource", dark ? R.drawable.widget_btn_bg : R.drawable.widget_btn_bg_light);
    }
    if (!wide) views.setInt(R.id.widget_scrim, "setBackgroundResource", dark ? R.drawable.widget_scrim : R.drawable.widget_scrim_light);
    views.setImageViewResource(R.id.widget_cover, R.drawable.widget_cover_placeholder);
    Bitmap bitmap = loadCover(pic, wide ? 160 : 520, wide ? 14 : 0);
    if (bitmap != null) views.setImageViewBitmap(R.id.widget_cover, bitmap);
    if (!wide && bitmap == null) views.setInt(R.id.widget_cover, "setBackgroundResource", dark ? R.drawable.widget_bg_dark : R.drawable.widget_bg_light);

    Intent open = new Intent().setClassName(PKG, PKG + ".MainActivity");
    open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, wide ? 10 : 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
    views.setOnClickPendingIntent(R.id.widget_play, broadcast(context, wide ? 11 : 1, WidgetActionReceiver.ACTION_TOGGLE));
    views.setOnClickPendingIntent(R.id.widget_next, broadcast(context, wide ? 12 : 2, WidgetActionReceiver.ACTION_NEXT));
    views.setOnClickPendingIntent(R.id.widget_prev, broadcast(context, wide ? 13 : 3, WidgetActionReceiver.ACTION_PREV));
    return views;
  }

  private static PendingIntent broadcast(Context context, int code, String action) {
    Intent intent = new Intent(context, WidgetActionReceiver.class).setAction(action);
    return PendingIntent.getBroadcast(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  private static Bitmap loadCover(String pic, int size, int radius) {
    try {
      if (pic == null || pic.isEmpty()) return null;
      String path = pic.startsWith("file://") ? Uri.parse(pic).getPath() : pic;
      if (path == null || !new File(path).exists()) return null;
      Bitmap source = BitmapFactory.decodeFile(path);
      if (source == null) return null;
      Bitmap scaled = Bitmap.createScaledBitmap(source, size, size, true);
      if (radius <= 0) return scaled;
      Bitmap rounded = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
      Canvas canvas = new Canvas(rounded);
      Path pathShape = new Path();
      pathShape.addRoundRect(new RectF(0, 0, size, size), radius, radius, Path.Direction.CW);
      canvas.clipPath(pathShape);
      canvas.drawBitmap(scaled, 0, 0, new Paint(Paint.FILTER_BITMAP_FLAG));
      return rounded;
    } catch (Exception e) { return null; }
  }
}
