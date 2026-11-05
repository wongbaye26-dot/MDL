package cn.emomusic.mobile.utils;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Rect;
import android.net.Uri;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Environment;
import android.util.DisplayMetrics;
import android.util.Log;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.app.LocaleManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.os.LocaleListCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeArray;

import java.io.File;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

public class UtilsModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
  private final ReactApplicationContext reactContext;

  /** MainActivity 的 insets 回调是静态调用，通过这里找到当前 JS 上下文发事件 */
  private static WeakReference<ReactApplicationContext> reactContextRef = new WeakReference<>(null);

  private int listenerCount = 0;

  /** JS 是否请求了窗口尺寸变化事件（utils.ts 的 onWindowSizeChange） */
  private boolean windowSizeListenerEnabled = false;
  private View observedDecorView = null;

  /** 窗口/根视图尺寸变化时通知 JS：分屏、小窗、折叠屏形态切换都会走这里 */
  private final View.OnLayoutChangeListener decorLayoutChangeListener = new View.OnLayoutChangeListener() {
    @Override
    public void onLayoutChange(View view, int left, int top, int right, int bottom,
        int oldLeft, int oldTop, int oldRight, int oldBottom) {
      if (right - left == oldRight - oldLeft && bottom - top == oldBottom - oldTop) return;
      notifyWindowMetricsChanged();
    }
  };

  UtilsEvent utilsEvent;

  UtilsModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
    reactContextRef = new WeakReference<>(reactContext);
    utilsEvent = new UtilsEvent(reactContext);
    reactContext.addLifecycleEventListener(this);
    registerScreenBroadcastReceiver();
  }

  @Override
  public String getName() {
    return "UtilsModule";
  }

  @ReactMethod
  public void addListener(String eventName) {
    if (listenerCount == 0) {
      // Set up any upstream listeners or background tasks as necessary
    }

    listenerCount += 1;
  }

  @ReactMethod
  public void removeListeners(Integer count) {
    listenerCount -= count;
    if (listenerCount == 0) {
      // Remove upstream listeners, stop unnecessary background tasks
    }
  }

  private void registerScreenBroadcastReceiver() {
    final IntentFilter theFilter = new IntentFilter();
    /** System Defined Broadcast */
    theFilter.addAction(Intent.ACTION_SCREEN_ON);
    theFilter.addAction(Intent.ACTION_SCREEN_OFF);

    BroadcastReceiver screenOnOffReceiver = new BroadcastReceiver() {
      @Override
      public void onReceive(Context context, Intent intent) {
        String strAction = intent.getAction();

        WritableMap params = Arguments.createMap();

        switch (Objects.requireNonNull(strAction)) {
          case Intent.ACTION_SCREEN_OFF:

            params.putString("state", "OFF");
            utilsEvent.sendEvent(utilsEvent.SCREEN_STATE, params);
            break;
          case Intent.ACTION_SCREEN_ON:
            params.putString("state", "ON");
            utilsEvent.sendEvent(utilsEvent.SCREEN_STATE, params);
            break;
        }
      }
    };

    try {
      // targetSdk 34+：动态注册非系统广播必须显式声明是否导出，否则 SecurityException。
      // SCREEN_ON/OFF 是受保护的系统广播，用 NOT_EXPORTED 即可（其它 App 不能伪造）。
      ContextCompat.registerReceiver(reactContext, screenOnOffReceiver, theFilter, ContextCompat.RECEIVER_NOT_EXPORTED);
    } catch (Exception e) {
      Log.e("Utils", "register screen state receiver failed", e);
    }
  }

  @ReactMethod
  public void exitApp() {
    // https://github.com/wumke/react-native-exit-app/blob/master/android/src/main/java/com/github/wumke/RNExitApp/RNExitAppModule.java
    // android.os.Process.killProcess(android.os.Process.myPid());

    // https://stackoverflow.com/questions/6330200/how-to-quit-android-application-programmatically
    Activity currentActivity = reactContext.getCurrentActivity();
    Log.d("Utils", "Exit app...");
    if (currentActivity == null) {
      Log.d("Utils", "killProcess");
      android.os.Process.killProcess(android.os.Process.myPid());
    } else {
      currentActivity.finishAndRemoveTask();
      System.exit(0);
    }
  }

  @ReactMethod
  public void getSupportedAbis(Promise promise) {
    // https://github.com/react-native-device-info/react-native-device-info/blob/ff8f672cb08fa39a887567d6e23e2f08778e8340/android/src/main/java/com/learnium/RNDeviceInfo/RNDeviceModule.java#L877
    WritableArray array = new WritableNativeArray();
    for (String abi : Build.SUPPORTED_ABIS) {
      array.pushString(abi);
    }
    promise.resolve(array);
  }

  @ReactMethod
  public void installApk(String filePath, String fileProviderAuthority, Promise promise) {
    // https://github.com/mikehardy/react-native-update-apk/blob/master/android/src/main/java/net/mikehardy/rnupdateapk/RNUpdateAPK.java
    File file = new File(filePath);
    if (!file.exists()) {
      Log.e("Utils", "installApk: file doe snot exist '" + filePath + "'");
      // FIXME this should take a promise and fail it
      promise.reject("Utils", "installApk: file doe snot exist '" + filePath + "'");
      return;
    }

    if (Build.VERSION.SDK_INT >= 24) {
      // API24 and up has a package installer that can handle FileProvider content:// URIs
      Uri contentUri;
      try {
        contentUri = FileProvider.getUriForFile(getReactApplicationContext(), fileProviderAuthority, file);
      } catch (Exception e) {
        // FIXME should be a Promise.reject really
        Log.e("Utils", "installApk exception with authority name '" + fileProviderAuthority + "'", e);
        promise.reject("Utils", "installApk exception with authority name '" + fileProviderAuthority + "'");
        return;
        // throw e;
      }
      Intent installApp = new Intent(Intent.ACTION_INSTALL_PACKAGE);
      installApp.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      installApp.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      installApp.setData(contentUri);
      installApp.putExtra(Intent.EXTRA_INSTALLER_PACKAGE_NAME, reactContext.getApplicationInfo().packageName);
      reactContext.startActivity(installApp);
      promise.resolve(null);
    } else {
      // Old APIs do not handle content:// URIs, so use an old file:// style
      String cmd = "chmod 777 " + file;
      try {
        Runtime.getRuntime().exec(cmd);
      } catch (Exception e) {
        // e.printStackTrace();
        Log.e("Utils", "installApk exception : " + e.getMessage(), e);
        promise.reject("Utils", e.getMessage());
      }
      Intent intent = new Intent(Intent.ACTION_VIEW);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      intent.setDataAndType(Uri.parse("file://" + file), "application/vnd.android.package-archive");
      reactContext.startActivity(intent);
      promise.resolve(null);
    }
  }

  @ReactMethod
  public void screenkeepAwake() {
    // https://github.com/corbt/react-native-keep-awake/blob/master/android/src/main/java/com/corbt/keepawake/KCKeepAwake.java
    final Activity activity = getCurrentActivity();

    if (activity != null) {
      activity.runOnUiThread(() -> {
        activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
      });
    }
  }

  @ReactMethod
  public void screenUnkeepAwake() {
    // https://github.com/corbt/react-native-keep-awake/blob/master/android/src/main/java/com/corbt/keepawake/KCKeepAwake.java
    final Activity activity = getCurrentActivity();

    if (activity != null) {
      activity.runOnUiThread(() -> {
        activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
      });
    }
  }

  /**
   Gets the device's WiFi interface IP address
   @return device's WiFi IP if connected to WiFi, else '0.0.0.0'
   */
  @ReactMethod
  public void getWIFIIPV4Address(final Promise promise) throws Exception {
    // https://github.com/pusherman/react-native-network-info/blob/master/android/src/main/java/com/pusherman/networkinfo/RNNetworkInfo.java
    WifiManager wifi = (WifiManager) reactContext.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
    new Thread(new Runnable() {
      public void run() {
        try {
          WifiInfo info = wifi.getConnectionInfo();
          int ipAddress = info.getIpAddress();
          @SuppressLint("DefaultLocale") String stringip = String.format("%d.%d.%d.%d", (ipAddress & 0xff), (ipAddress >> 8 & 0xff),
            (ipAddress >> 16 & 0xff), (ipAddress >> 24 & 0xff));
          promise.resolve(stringip);
        }catch (Exception e) {
          promise.resolve(null);
        }
      }
    }).start();
  }

  // https://stackoverflow.com/a/26117646
  @ReactMethod
  public void getDeviceName(final Promise promise) {
    String manufacturer = Build.MANUFACTURER;
    String model = Build.MODEL;
    if (model.startsWith(manufacturer)) {
      promise.resolve(capitalize(model));
    } else {
      promise.resolve(capitalize(manufacturer) + " " + model);
    }
  }
  private String capitalize(String s) {
    if (s == null || s.isEmpty()) {
      return "";
    }
    char first = s.charAt(0);
    if (Character.isUpperCase(first)) {
      return s;
    } else {
      return Character.toUpperCase(first) + s.substring(1);
    }
  }

  @ReactMethod
  public void isNotificationsEnabled(final Promise promise) {
    new Thread(() -> {
      boolean enabled = NotificationPermissionUtil.isNotificationsEnabled(
        reactContext.getApplicationContext());
      promise.resolve(enabled);
    }).start();
  }

  @ReactMethod
  public void openNotificationPermissionActivity(Promise promise) {
    new Thread(() -> {
      boolean result = NotificationPermissionUtil.openNotificationPermissionActivity(
        reactContext.getApplicationContext());
      promise.resolve(result);
    }).start();
  }

  @ReactMethod
  public void shareText(String shareTitle, String title, String text) {
    Intent shareIntent = new Intent(Intent.ACTION_SEND);
    shareIntent.setType("text/plain");
    shareIntent.putExtra(Intent.EXTRA_TEXT,text);
    shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
    Objects.requireNonNull(reactContext.getCurrentActivity()).startActivity(Intent.createChooser(shareIntent, shareTitle));
  }

  // https://stackoverflow.com/questions/73463341/in-per-app-language-how-to-get-app-locale-in-api-33-if-system-locale-is-diffe
  @ReactMethod
  public void getSystemLocales(Promise promise) {
    Locale locale = null;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      LocaleListCompat list = LocaleManagerCompat.getSystemLocales(reactContext);
      if (!list.isEmpty()) {
        locale = list.get(0);
      } else {
        promise.resolve(null);
        return;
      }
    } else {
      locale = Locale.getDefault();
    }
    if (locale == null) {
      promise.resolve("");
      return;
    }

    // 格式化成 zh_cn、en_us 等
    String language = locale.getLanguage(); // zh, en
    String country = locale.getCountry();   // CN, US
    String localeStr;

    if (!country.isEmpty()) {
      localeStr = language.toLowerCase() + "_" + country.toLowerCase();
    } else {
      localeStr = language.toLowerCase();
    }

    promise.resolve(localeStr);
  }

  // https://github.com/Anthonyzou/react-native-full-screen/blob/master/android/src/main/java/com/rn/full/screen/FullScreen.java
  //  @ReactMethod
  //  public void onFullScreen() {
  //    UiThreadUtil.runOnUiThread(() -> {
  //      Activity currentActivity = reactContext.getCurrentActivity();
  //      if (currentActivity == null) return;
  //      currentActivity.getWindow().getDecorView().setSystemUiVisibility(
  //        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
  //          | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
  //          | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
  //          | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION // hide nav bar
  //          | View.SYSTEM_UI_FLAG_FULLSCREEN // hide status bar
  //          | View.SYSTEM_UI_FLAG_IMMERSIVE
  //      );
  //    });
  //  }
  //  @ReactMethod
  //  public void offFullScreen() {
  //    UiThreadUtil.runOnUiThread(() -> {
  //      Activity currentActivity = reactContext.getCurrentActivity();
  //      if (currentActivity == null) return;
  //      currentActivity.getWindow().getDecorView().setSystemUiVisibility(
  //        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
  //          | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
  //          | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
  //      );
  //    });
  //  }

  @ReactMethod
  public void getWindowSize(Promise promise) {
    WritableMap params = Arguments.createMap();

    Activity currentActivity = reactContext.getCurrentActivity();
    if (currentActivity == null) {
      params.putInt("width", 0);
      params.putInt("height", 0);
      promise.resolve(params);
      return;
    }
    // 获取当前应用可用区域大小
    Window window = currentActivity.getWindow();
    Rect rect = new Rect();
    window.getDecorView().getWindowVisibleDisplayFrame(rect);
    // View decorView = window.getDecorView();
    // int width = decorView.getMeasuredWidth();
    // int height = decorView.getMeasuredHeight();
    params.putInt("width", rect.width());
    params.putInt("height", rect.height());
    promise.resolve(params);
  }

  @ReactMethod
  public void isIgnoringBatteryOptimization(Promise promise) {
    new Thread(() -> {
      boolean result = BatteryOptimizationUtil.isIgnoringBatteryOptimization(
        reactContext.getApplicationContext(),
        reactContext.getPackageName()
      );
      promise.resolve(result);
    }).start();
  }

  @ReactMethod
  public void requestIgnoreBatteryOptimization(Promise promise) {
    new Thread(() -> {
      try {
        boolean result = BatteryOptimizationUtil.requestIgnoreBatteryOptimization(
          reactContext.getApplicationContext(),
          reactContext.getPackageName()
        );
        promise.resolve(result);
      } catch (Exception e) {
        promise.reject("ERROR", e);
      }
    }).start();
  }

  /**
   * 读取系统 Material You 主题色（Android 12+），低版本回退到 colorAccent。
   * 返回十六进制字符串，如 "#6C5CE7"；读取失败返回 null。
   */
  @ReactMethod
  public void getSystemAccentColor(Promise promise) {
    try {
      int color = 0;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        // system_accent1_500 是 Material You 的主色调
        color = reactContext.getResources().getColor(android.R.color.system_accent1_500, null);
      } else {
        android.util.TypedValue value = new android.util.TypedValue();
        boolean found = reactContext.getTheme().resolveAttribute(android.R.attr.colorAccent, value, true);
        if (found) {
          if (value.resourceId != 0) {
            color = reactContext.getResources().getColor(value.resourceId);
          } else {
            color = value.data;
          }
        }
      }
      if (color == 0) {
        promise.resolve(null);
        return;
      }
      String hex = String.format("#%06X", 0xFFFFFF & color);
      promise.resolve(hex);
    } catch (Exception e) {
      Log.e("Utils", "getSystemAccentColor error: " + e.getMessage(), e);
      promise.resolve(null);
    }
  }

  /**
   * 一次返回 Material You 的整套色板（accent1~3 / neutral1~2 的关键档位）。
   * Android 12 以下返回空 Map。
   */
  @ReactMethod
  public void getSystemColorPalette(Promise promise) {
    WritableMap result = Arguments.createMap();
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      promise.resolve(result);
      return;
    }
    try {
      int[][] groups = {
        {android.R.color.system_accent1_100, android.R.color.system_accent1_200, android.R.color.system_accent1_500, android.R.color.system_accent1_700},
        {android.R.color.system_accent2_100, android.R.color.system_accent2_200, android.R.color.system_accent2_500, android.R.color.system_accent2_700},
        {android.R.color.system_accent3_100, android.R.color.system_accent3_200, android.R.color.system_accent3_500, android.R.color.system_accent3_700},
        {android.R.color.system_neutral1_100, android.R.color.system_neutral1_500, android.R.color.system_neutral1_900},
        {android.R.color.system_neutral2_100, android.R.color.system_neutral2_500, android.R.color.system_neutral2_900},
      };
      String[] names = {"accent1", "accent2", "accent3", "neutral1", "neutral2"};
      for (int i = 0; i < groups.length; i++) {
        WritableArray arr = new WritableNativeArray();
        for (int resId : groups[i]) {
          int c = reactContext.getResources().getColor(resId, null);
          arr.pushString(String.format("#%06X", 0xFFFFFF & c));
        }
        result.putArray(names[i], arr);
      }
      promise.resolve(result);
    } catch (Exception e) {
      Log.e("Utils", "getSystemColorPalette error: " + e.getMessage(), e);
      promise.resolve(result);
    }
  }

  /**
   * 设置窗口底色（RN 根视图与 Activity 窗口）。
   *
   * 切换主题时 JS 侧整棵树会重新渲染，在首帧提交前会短暂露出窗口底色：
   * 系统 DayNight 主题下亮色为白、暗色为黑，就是用户看到的「黑白闪屏」。
   * 这里让窗口底色跟随当前主题，任何未绘制的瞬间都只会露出主题色本身。
   *
   * @param color 形如 #RRGGBB 或 #AARRGGBB
   */
  @ReactMethod
  public void setWindowBackgroundColor(String color) {
    try {
      final int parsed = android.graphics.Color.parseColor(color);
      final Activity activity = getCurrentActivity();
      if (activity == null) return;
      activity.runOnUiThread(() -> {
        try {
          Window window = activity.getWindow();
          window.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(parsed));
          View decor = window.getDecorView();
          if (decor != null) decor.setBackgroundColor(parsed);
          View root = activity.findViewById(android.R.id.content);
          if (root != null) root.setBackgroundColor(parsed);
        } catch (Exception e) {
          Log.e("Utils", "setWindowBackgroundColor ui error: " + e.getMessage(), e);
        }
      });
    } catch (Exception e) {
      Log.e("Utils", "setWindowBackgroundColor error: " + e.getMessage(), e);
    }
  }
  /** 是否已授予「所有文件访问权限」（Android 11+ 写公共 Music 目录必需） */
  @ReactMethod
  public void isExternalStorageManager(Promise promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        promise.resolve(Environment.isExternalStorageManager());
      } else {
        promise.resolve(true);
      }
    } catch (Exception e) {
      promise.reject("ERR", e);
    }
  }

  /** 跳系统「所有文件访问权限」设置页（当前应用） */
  @ReactMethod
  public void openAllFilesAccessSettings(Promise promise) {
    try {
      Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
      intent.setData(Uri.parse("package:" + getReactApplicationContext().getPackageName()));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getReactApplicationContext().startActivity(intent);
      promise.resolve(true);
    } catch (Exception e) {
      try {
        Intent fallback = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
        fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getReactApplicationContext().startActivity(fallback);
        promise.resolve(true);
      } catch (Exception e2) {
        promise.reject("ERR", e2);
      }
    }
  }

  // ==================================================================
  // 分屏 / 小窗 / 折叠屏：窗口尺寸与系统栏 insets
  // ==================================================================

  /** JS 订阅窗口尺寸变化：Android 15/16 下 RN 的 Dimensions 在分屏拖动时不一定刷新，由原生主动推 */
  @ReactMethod
  public void listenWindowSizeChanged() {
    windowSizeListenerEnabled = true;
    attachWindowSizeListener();
  }

  private void attachWindowSizeListener() {
    Activity activity = getCurrentActivity();
    if (activity == null) return;
    View decor = activity.getWindow().getDecorView();
    if (decor == null || decor == observedDecorView) return;
    if (observedDecorView != null) observedDecorView.removeOnLayoutChangeListener(decorLayoutChangeListener);
    observedDecorView = decor;
    observedDecorView.addOnLayoutChangeListener(decorLayoutChangeListener);
  }

  @Override
  public void onHostResume() {
    // 从后台回来 / Activity 重建后重新挂窗口尺寸监听（只在 JS 订阅过时才挂）
    if (windowSizeListenerEnabled) attachWindowSizeListener();
  }

  @Override
  public void onHostPause() {}

  @Override
  public void onHostDestroy() {}

  /**
   * 当前窗口的 insets。单位统一为 px；同时返回 density，除以它即 dp。
   * 返回结构：
   * {
   *   density: number,
   *   statusBars: { top, bottom, left, right },
   *   navigationBars: { ... },
   *   systemBars: { ... },
   *   cutout: { ... },              // 挖孔安全区
   *   ime: { ... },                 // 键盘；adjustResize 生效时可能为 0
   *   isInMultiWindowMode: boolean  // 分屏 / 小窗 / 画中画
   * }
   */
  @ReactMethod
  public void getWindowInsets(final Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        Activity activity = getCurrentActivity();
        WritableMap result = Arguments.createMap();
        if (activity == null) {
          putEmptyInsets(result);
          promise.resolve(result);
          return;
        }
        result.putDouble("density", getDensity(activity));
        putInsets(result, activity);
        promise.resolve(result);
      } catch (Exception e) {
        Log.e("Utils", "getWindowInsets error", e);
        WritableMap empty = Arguments.createMap();
        putEmptyInsets(empty);
        promise.resolve(empty);
      }
    });
  }

  /**
   * 通知 JS 窗口可用区域变了（分屏 / 小窗 / 导航栏模式变化）。
   * 由 MainActivity 的 insets 回调（底部 padding 变化）和 decor 的布局回调触发。
   */
  public static void notifyWindowMetricsChanged() {
    ReactApplicationContext context = reactContextRef.get();
    if (context == null || !context.hasActiveReactInstance()) return;
    try {
      WritableMap metrics = buildWindowMetrics(context);
      if (metrics == null) return;
      UtilsEvent event = new UtilsEvent(context);
      event.sendEvent(event.SCREEN_SIZE_CHANGED, metrics);
    } catch (Exception e) {
      // JS 销毁 / Activity 正在重建时发事件失败是正常现象，不能让窗口回调崩掉
      Log.w("Utils", "emit window metrics failed: " + e.getMessage());
    }
  }

  /**
   * 计算 RN 根视图实际可用区域（px + dp）以及 insets。
   * android.R.id.content 的 padding 是 MainActivity 为底部导航栏加的，
   * 所以可用高度要减掉 padding —— 与 RN 侧 SizeView 量到的布局高度保持一致。
   */
  private static WritableMap buildWindowMetrics(ReactApplicationContext context) {
    Activity activity = context.getCurrentActivity();
    if (activity == null) return null;
    View content = activity.findViewById(android.R.id.content);
    if (content == null) return null;

    float density = getDensity(activity);
    int pixelWidth = Math.max(0, content.getWidth() - content.getPaddingLeft() - content.getPaddingRight());
    int pixelHeight = Math.max(0, content.getHeight() - content.getPaddingTop() - content.getPaddingBottom());

    WritableMap map = Arguments.createMap();
    map.putInt("pixelWidth", pixelWidth);
    map.putInt("pixelHeight", pixelHeight);
    map.putInt("width", Math.round(pixelWidth / density));
    map.putInt("height", Math.round(pixelHeight / density));
    map.putDouble("density", density);
    putInsets(map, activity);
    return map;
  }

  private static void putInsets(WritableMap map, Activity activity) {
    WindowInsetsCompat insets = null;
    try {
      View decor = activity.getWindow().getDecorView();
      if (decor != null) insets = ViewCompat.getRootWindowInsets(decor);
    } catch (Exception e) {
      Log.w("Utils", "read window insets failed: " + e.getMessage());
    }
    if (insets == null) {
      putEmptyInsets(map);
      return;
    }
    putEdgeInsets(map, "statusBars", insets.getInsets(WindowInsetsCompat.Type.statusBars()));
    putEdgeInsets(map, "navigationBars", insets.getInsets(WindowInsetsCompat.Type.navigationBars()));
    putEdgeInsets(map, "systemBars", insets.getInsets(WindowInsetsCompat.Type.systemBars()));
    putEdgeInsets(map, "cutout", insets.getInsets(WindowInsetsCompat.Type.displayCutout()));
    putEdgeInsets(map, "ime", insets.getInsets(WindowInsetsCompat.Type.ime()));
    map.putBoolean("isInMultiWindowMode",
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && activity.isInMultiWindowMode());
  }

  private static void putEdgeInsets(WritableMap map, String key, Insets insets) {
    WritableMap edge = Arguments.createMap();
    edge.putInt("top", insets.top);
    edge.putInt("bottom", insets.bottom);
    edge.putInt("left", insets.left);
    edge.putInt("right", insets.right);
    map.putMap(key, edge);
  }

  private static void putEmptyInsets(WritableMap map) {
    String[] keys = {"statusBars", "navigationBars", "systemBars", "cutout", "ime"};
    for (String key : keys) {
      WritableMap edge = Arguments.createMap();
      edge.putInt("top", 0);
      edge.putInt("bottom", 0);
      edge.putInt("left", 0);
      edge.putInt("right", 0);
      map.putMap(key, edge);
    }
    map.putBoolean("isInMultiWindowMode", false);
    map.putDouble("density", 1);
  }

  private static float getDensity(Activity activity) {
    DisplayMetrics dm = activity.getResources().getDisplayMetrics();
    return dm == null || dm.density <= 0 ? 1f : dm.density;
  }

  // ==================================================================
  // 品牌兼容：自启动 / 电池 / 应用详情页（失败一律回落，不 crash）
  // ==================================================================

  @ReactMethod
  public void getManufacturer(Promise promise) {
    promise.resolve(safeBuildString(Build.MANUFACTURER));
  }

  @ReactMethod
  public void getBrand(Promise promise) {
    promise.resolve(safeBuildString(Build.BRAND));
  }

  @ReactMethod
  public void getModel(Promise promise) {
    promise.resolve(safeBuildString(Build.MODEL));
  }

  /** 设备/系统信息汇总，供 JS 侧做品牌适配提示 */
  @ReactMethod
  public void getDeviceCompatInfo(Promise promise) {
    try {
      WritableMap map = Arguments.createMap();
      map.putString("manufacturer", safeBuildString(Build.MANUFACTURER));
      map.putString("brand", safeBuildString(Build.BRAND));
      map.putString("model", safeBuildString(Build.MODEL));
      map.putString("device", safeBuildString(Build.DEVICE));
      map.putString("osVersion", safeBuildString(Build.VERSION.RELEASE));
      map.putInt("sdkInt", Build.VERSION.SDK_INT);
      promise.resolve(map);
    } catch (Exception e) {
      promise.reject("ERR", e);
    }
  }

  /** 打开系统默认的「应用详情页」（权限/通知/存储入口的最终兜底） */
  @ReactMethod
  public void openAppDetailsSettings(final Promise promise) {
    UiThreadUtil.runOnUiThread(() -> promise.resolve(openAppDetailsSettingsInternal()));
  }

  private boolean openAppDetailsSettingsInternal() {
    try {
      Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
      intent.setData(Uri.parse("package:" + reactContext.getPackageName()));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      reactContext.startActivity(intent);
      return true;
    } catch (Exception e) {
      Log.w("Utils", "openAppDetailsSettings failed: " + e.getMessage());
      try {
        // 极少数 ROM 连应用详情页都拦：退回系统设置首页
        Intent fallback = new Intent(Settings.ACTION_SETTINGS);
        fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        reactContext.startActivity(fallback);
        return true;
      } catch (Exception e2) {
        Log.e("Utils", "openAppDetailsSettings fallback failed", e2);
        return false;
      }
    }
  }

  /**
   * 打开厂商的「自启动 / 后台运行」管理页。
   * 按品牌依次尝试已知 Activity（ComponentName），全部失败时回落到应用详情页。
   * Promise resolve: { opened: boolean, target: string }，target = 包名 / appDetails / none。
   */
  @ReactMethod
  public void openAutoStartSettings(final Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      String target = null;
      try {
        String manufacturer = safeBuildString(Build.MANUFACTURER).toLowerCase(Locale.ROOT);
        String brand = safeBuildString(Build.BRAND).toLowerCase(Locale.ROOT);
        List<String[]> candidates = getAutoStartCandidates(manufacturer, brand);
        for (String[] candidate : candidates) {
          if (tryStartComponent(candidate[0], candidate[1])) {
            target = candidate[0];
            break;
          }
        }
      } catch (Exception e) {
        Log.w("Utils", "openAutoStartSettings failed: " + e.getMessage());
      }
      if (target != null) {
        promise.resolve(buildOpenResult(true, target));
        return;
      }
      // 所有品牌页面都打不开：回落到应用详情页（不抛异常、不让 JS 崩）
      boolean opened = openAppDetailsSettingsInternal();
      promise.resolve(buildOpenResult(opened, opened ? "appDetails" : "none"));
    });
  }

  private static WritableMap buildOpenResult(boolean opened, String target) {
    WritableMap result = Arguments.createMap();
    result.putBoolean("opened", opened);
    result.putString("target", target);
    return result;
  }

  private boolean tryStartComponent(String packageName, String className) {
    try {
      Intent intent = new Intent();
      intent.setComponent(new ComponentName(packageName, className));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      // 显式组件 resolveActivity 返回 null，说明这个 ROM 没有对应页面
      if (reactContext.getPackageManager().resolveActivity(intent, 0) == null) return false;
      reactContext.startActivity(intent);
      return true;
    } catch (Exception e) {
      Log.w("Utils", "open " + packageName + "/" + className + " failed: " + e.getMessage());
      return false;
    }
  }

  private static List<String[]> getAutoStartCandidates(String manufacturer, String brand) {
    List<String[]> list = new ArrayList<>();
    String name = manufacturer + "/" + brand;
    if (matchBrand(name, "xiaomi", "redmi", "poco")) {
      addCandidate(list, "com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity");
      addCandidate(list, "com.miui.securitycenter", "com.miui.powercenter.PowerSettings");
    } else if (matchBrand(name, "huawei", "honor")) {
      addCandidate(list, "com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity");
      addCandidate(list, "com.huawei.systemmanager", "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity");
      addCandidate(list, "com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity");
    } else if (matchBrand(name, "oppo", "oplus", "oneplus", "realme")) {
      addCandidate(list, "com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity");
      addCandidate(list, "com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity");
      addCandidate(list, "com.oplus.safecenter", "com.oplus.safecenter.permission.startup.StartupAppListActivity");
      addCandidate(list, "com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity");
    } else if (matchBrand(name, "vivo", "iqoo")) {
      addCandidate(list, "com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity");
      addCandidate(list, "com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager");
    } else if (matchBrand(name, "samsung")) {
      // 三星没有单独的「自启动」开关，只有「电池 → 后台使用限制」
      addCandidate(list, "com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity");
      addCandidate(list, "com.android.settings", "com.android.settings.Settings$HighPowerApplicationsActivity");
    } else if (matchBrand(name, "meizu", "mblu")) {
      addCandidate(list, "com.meizu.safe", "com.meizu.safe.permission.SmartBGActivity");
      addCandidate(list, "com.meizu.safe", "com.meizu.safe.security.SecureMainActivity");
    }
    // 通用兜底：部分 ROM 把「电池优化 / 高耗电应用」作为后台限制入口
    addCandidate(list, "com.android.settings", "com.android.settings.Settings$HighPowerApplicationsActivity");
    return list;
  }

  private static void addCandidate(List<String[]> list, String packageName, String className) {
    list.add(new String[]{packageName, className});
  }

  private static boolean matchBrand(String name, String... keywords) {
    for (String keyword : keywords) {
      if (name.contains(keyword)) return true;
    }
    return false;
  }

  private static String safeBuildString(String value) {
    return value == null ? "" : value;
  }

}

