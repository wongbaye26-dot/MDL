package cn.toside.music.mobile;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;

import com.reactnativenavigation.NavigationActivity;

public class MainActivity extends NavigationActivity {

  /**
   * 真·全屏（含挖孔区）。
   *
   * 横屏时前置挖孔在屏幕左侧，系统默认把它当成不可用区域给窗口做 letterbox，
   * 于是左边永远留一条 96px 的白边（窗口底色）。只在主题里写
   * windowLayoutInDisplayCutoutMode=shortEdges 在 Android 15+ 上不够，
   * 这里在窗口层再强制一次：
   *  - ALWAYS：允许窗口画进挖孔区（API 30+，更早的版本退回 SHORT_EDGES）；
   *  - setDecorFitsSystemWindows(false)：内容自己负责状态栏/导航栏留白
   *    （RN 侧本来就用 statusbarHeight 手动让位）。
   */
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      WindowManager.LayoutParams attrs = getWindow().getAttributes();
      attrs.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
          ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
          : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
      getWindow().setAttributes(attrs);
    }
  }
}
