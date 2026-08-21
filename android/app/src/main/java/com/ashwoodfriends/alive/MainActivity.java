package com.ashwoodfriends.alive;

import android.os.SystemClock;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long EXIT_CONFIRMATION_WINDOW_MS = 2000L;
    private long lastRootBackPressAt;

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(GooglePlayBillingPlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleAppBackPress();
            }
        });
    }

    private void handleAppBackPress() {
        if (bridge != null && bridge.getWebView().canGoBack()) {
            bridge.getWebView().goBack();
            return;
        }
        long now = SystemClock.elapsedRealtime();
        if (now - lastRootBackPressAt <= EXIT_CONFIRMATION_WINDOW_MS) {
            finishAndRemoveTask();
            return;
        }
        lastRootBackPressAt = now;
    }
}
