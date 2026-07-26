package app.moonfeed.mobile;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.util.Log;

import java.util.List;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges the Solana Mobile Wallet Adapter (MWA) for the Capacitor WebView.
 *
 * The MWA JS library opens wallet apps by navigating to
 * window.location.assign('solana-wallet://...'). Inside a Capacitor WebView on
 * Android 11+, that navigation fails silently because the manifest lacks a
 * <queries> entry for the "solana-wallet" scheme, so the MWA JS never sees a
 * window "blur" and reports "found no installed wallet".
 *
 * This plugin closes that gap:
 *   1. Intercepts solana-wallet:// navigations via shouldOverrideLoad().
 *   2. Dispatches a proper ACTION_VIEW intent with BROWSABLE + DEFAULT.
 *   3. Fires a synthetic window "blur" so the MWA JS detection resolves.
 *
 * The encrypted WebSocket phase of the MWA protocol runs entirely in JS.
 */
@CapacitorPlugin(name = "SolanaMWA")
public class SolanaMWAPlugin extends Plugin {

    private static final String TAG = "SolanaMWA";

    @Override
    public void load() {
        Log.d(TAG, "[load] SolanaMWA plugin registered and loaded");
    }

    /**
     * Intercept solana-wallet:// navigations from the WebView. Called by the
     * Capacitor bridge before the default handler for every URL navigation.
     *
     * @param url the URL the WebView is trying to navigate to
     * @return true to cancel navigation (handled here), null to defer to default
     */
    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        if (url != null && "solana-wallet".equals(url.getScheme())) {
            Log.d(TAG, "[shouldOverrideLoad] Intercepted solana-wallet URI");
            launchWalletIntent(url);
            return true;
        }
        return null;
    }

    /**
     * Check if any MWA-compatible wallet is installed on this device.
     */
    @PluginMethod()
    public void isAvailable(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("solana-wallet:/v1/associate/local"));
        intent.addCategory(Intent.CATEGORY_BROWSABLE);

        List<ResolveInfo> resolvers = getActivity()
                .getPackageManager()
                .queryIntentActivities(intent, 0);

        Log.d(TAG, "[isAvailable] MWA wallets found: " + resolvers.size());
        for (ResolveInfo ri : resolvers) {
            Log.d(TAG, "[isAvailable] wallet: " + ri.activityInfo.packageName);
        }

        JSObject ret = new JSObject();
        ret.put("available", resolvers.size() > 0);
        call.resolve(ret);
    }

    /**
     * JS-callable fallback to launch a wallet intent manually, in case
     * shouldOverrideLoad does not fire in a given setup.
     *
     * @param call PluginCall with { uri: "solana-wallet://..." }
     */
    @PluginMethod()
    public void launchWalletUri(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null || uri.isEmpty()) {
            call.reject("Must provide 'uri' parameter");
            return;
        }
        Log.d(TAG, "[launchWalletUri] Called from JS");
        boolean success = launchWalletIntent(Uri.parse(uri));
        if (success) {
            JSObject ret = new JSObject();
            ret.put("launched", true);
            call.resolve(ret);
        } else {
            call.reject("No MWA-compatible wallet found. Install a Solana wallet that supports Mobile Wallet Adapter.");
        }
    }

    /**
     * Dispatch the solana-wallet:// URI as an Android intent with the correct
     * categories, then fire a synthetic blur event so the MWA JS detection
     * promise resolves.
     */
    private boolean launchWalletIntent(Uri uri) {
        Log.d(TAG, "[launchWalletIntent] scheme=" + uri.getScheme() + " path=" + uri.getPath());

        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.addCategory(Intent.CATEGORY_DEFAULT);

        List<ResolveInfo> resolvers = getActivity()
                .getPackageManager()
                .queryIntentActivities(intent, 0);
        Log.d(TAG, "[launchWalletIntent] resolvers=" + resolvers.size());
        for (ResolveInfo ri : resolvers) {
            Log.d(TAG, "[launchWalletIntent] resolver: "
                    + ri.activityInfo.packageName + "/" + ri.activityInfo.name);
        }

        try {
            getActivity().startActivity(intent);
            Log.d(TAG, "[launchWalletIntent] Intent dispatched successfully");

            // Fire synthetic blur event so the MWA JS detection promise resolves
            // (the MWA protocol library waits for window blur to confirm the wallet opened).
            getBridge().eval("window.dispatchEvent(new Event('blur'))", null);
            return true;
        } catch (ActivityNotFoundException e) {
            Log.e(TAG, "[launchWalletIntent] No wallet app found for: " + uri, e);
            return false;
        } catch (Exception e) {
            Log.e(TAG, "[launchWalletIntent] Failed: " + e.getMessage(), e);
            return false;
        }
    }
}
