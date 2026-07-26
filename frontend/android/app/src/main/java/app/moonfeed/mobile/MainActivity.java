package app.moonfeed.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register BEFORE super.onCreate() so the plugin is available at bridge init.
        registerPlugin(SolanaMWAPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
