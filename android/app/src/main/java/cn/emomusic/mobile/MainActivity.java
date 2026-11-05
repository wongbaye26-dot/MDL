package cn.emomusic.mobile;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.reactnativenavigation.NavigationActivity;

import cn.emomusic.mobile.utils.UtilsModule;

public class MainActivity extends NavigationActivity {

  /** android.R.id.content 原本的底部 padding（正常是 0，这里保留是为了不覆盖主题/系统给的留白） */
  private int contentInitialPaddingBottom = 0;

  /**
   * 真·全屏（含挖孔区）。
   *
   * 横屏时前置挖孔在屏幕左侧，系统默认把它当成不可用区域给窗口做 letterbox，
   * 于是左边永远留一条 96px 的白边（窗口底色）。只在主题里写
   * windowLayoutInDisplayCutoutMode=shortEdges 在 Android 15+ 上不够，
   * 这里在窗口层再强制一次：
   *  - ALWAYS：允许窗口画进挖孔区（API 30+，更早的版本退回 SHORT_EDGES）；
   *  - setDecorFitsSystemWindows(false)：内容自己负责状态栏/导航栏留白
   *    （RN 侧本来就用 statusbarHeight 手动让位，这里补上底部导航栏）。
   *
   * targetSdk 36（Android 16）起 edge-to-edge 强制且不可 opt-out，
   * 底部导航栏不再给内容让位，所以必须由这里处理（见 setupBottomInsetPadding）。
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

    setupBottomInsetPadding();
  }

  @Override
  public void onConfigurationChanged(android.content.res.Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    // 分屏/小窗/折叠屏切换、手势导航 ↔ 三键导航切换后重新要一次 insets，
    // 保证底部 padding 及时更新（系统一般也会自己重新分发，这里只是兜底）。
    View content = findViewById(android.R.id.content);
    if (content != null) ViewCompat.requestApplyInsets(content);
  }

  /**
   * 把底部 navigationBars inset 作为根内容（android.R.id.content）的 padding。
   *
   * 为什么只处理底部：
   *  - 顶部状态栏留白仍然由 RN 侧 statusbarHeight 手动处理（PageHeader/SizeView 等）；
   *  - 横屏挖孔的左/右留白由 RN 的 CutoutCompensator 用「窗口宽 - 布局宽」的负 margin 补偿，
   *    这里如果再加左右 padding 会和它打架，所以保持现状。
   *
   * 分屏 / 小窗 / 手势导航 / 三键导航 / 键盘弹出收起时 insets 会重新分发，
   * padding 自动跟着变；RN 根视图因此始终在导航栏上方。
   * 返回 insets（不消费）：RN 根视图和子 View 仍然能拿到原始 insets。
   */
  private void setupBottomInsetPadding() {
    final View content = findViewById(android.R.id.content);
    if (content == null) return;

    contentInitialPaddingBottom = content.getPaddingBottom();

    ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
      Insets navigationBars = windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars());
      int bottom = contentInitialPaddingBottom + navigationBars.bottom;
      if (view.getPaddingBottom() != bottom) {
        view.setPadding(view.getPaddingLeft(), view.getPaddingTop(), view.getPaddingRight(), bottom);
        // padding 变化会改变 RN 根视图尺寸，但 Android 15/16 下 RN 的 Dimensions
        // 不一定跟着更新，这里主动通知 JS（windowSizeTools 会重新测量并刷新窗口尺寸）
        view.post(() -> UtilsModule.notifyWindowMetricsChanged());
      }
      return windowInsets;
    });

    ViewCompat.requestApplyInsets(content);
  }
}
