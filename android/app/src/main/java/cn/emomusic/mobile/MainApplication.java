package cn.emomusic.mobile;

import com.facebook.react.PackageList;
import com.reactnativenavigation.NavigationApplication;
import com.facebook.react.ReactHost;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.defaults.DefaultReactHost;
import com.reactnativenavigation.react.NavigationReactNativeHost;
import java.util.List;

import cn.emomusic.mobile.cache.CachePackage;
import cn.emomusic.mobile.crypto.CryptoPackage;
import cn.emomusic.mobile.dirpicker.DirectoryPickerPackage;
import cn.emomusic.mobile.download.DownloadPackage;
import cn.emomusic.mobile.widget.WidgetPackage;
import cn.emomusic.mobile.lyric.LyricPackage;
import cn.emomusic.mobile.userApi.UserApiPackage;
import cn.emomusic.mobile.utils.UtilsPackage;

public class MainApplication extends NavigationApplication {

  private final ReactNativeHost mReactNativeHost =
      new NavigationReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
          return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
          @SuppressWarnings("UnnecessaryLocalVariable")
          List<ReactPackage> packages = new PackageList(this).getPackages();
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // packages.add(new MyReactNativePackage());
          packages.add(new CachePackage());
          packages.add(new LyricPackage());
          packages.add(new UtilsPackage());
          packages.add(new CryptoPackage());
          packages.add(new UserApiPackage());
          packages.add(new DownloadPackage());
          packages.add(new DirectoryPickerPackage());
          packages.add(new WidgetPackage());
          return packages;
        }

        @Override
        protected String getJSMainModuleName() {
          return "index";
        }

        @Override
        protected boolean isNewArchEnabled() {
          return BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
        }

        @Override
        protected Boolean isHermesEnabled() {
          return BuildConfig.IS_HERMES_ENABLED;
        }
      };

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

  // RNN 8.6.2 的 NavigationApplication 用 ReactHost（新架构）建 ReactGateway；
  // NavigationApplication.onCreate() 内部已负责 SoLoader.init + DefaultNewArchitectureEntryPoint.load()，
  // 所以这里不能再重复 load（否则会重复初始化）。
  @Override
  public ReactHost getReactHost() {
    // RN 0.80 的 Java 签名是 (Context, ReactNativeHost, JSRuntimeFactory?)，Kotlin 模板靠默认参数省略第三个
    return DefaultReactHost.getDefaultReactHost(getApplicationContext(), mReactNativeHost, null);
  }
}
