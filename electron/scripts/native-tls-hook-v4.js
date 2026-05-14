/**
 * Trafexia Native TLS Bypass
 * Handles native-level SSL pinning (BoringSSL, OpenSSL, Cronet, Flutter)
 * that the Java-level unpinning scripts cannot reach.
 *
 * Uses Process.getModuleByName() instead of Module.findExportByName()
 * to work around trafexia-daemon's overwritten Module global.
 */

(function() {
    'use strict';

    console.log("[NativeTLS] Starting native TLS bypass...");

    function findExport(expName) {
        try {
            var mods = Process.enumerateModules();
            for (var i = 0; i < mods.length; i++) {
                var addr = mods[i].findExportByName(expName);
                if (addr) return addr;
            }
        } catch (e) {}
        return null;
    }

    function findExportInModule(modName, expName) {
        try {
            return Process.getModuleByName(modName).findExportByName(expName);
        } catch (e) {}
        return null;
    }

    function applyNativeHooks() {
        var ok_cb = new NativeCallback(function() { return 1; }, 'int', ['pointer', 'pointer']);
        var hooked = 0;

        var mods = Process.enumerateModules();
        for (var i = 0; i < mods.length; i++) {
            var m = mods[i];
            if (m.name.indexOf("ssl") === -1 &&
                m.name.indexOf("cronet") === -1 &&
                m.name.indexOf("flutter") === -1) continue;

            // Hook SSL_set_custom_verify / SSL_CTX_set_custom_verify — swap the verify callback
            var setters = ["SSL_CTX_set_cert_verify_callback", "SSL_set_custom_verify", "SSL_CTX_set_custom_verify"];
            for (var j = 0; j < setters.length; j++) {
                var addr = m.findExportByName(setters[j]);
                if (addr) {
                    try {
                        Interceptor.attach(addr, {
                            onEnter: function(args) { args[1] = ok_cb; }
                        });
                        hooked++;
                    } catch (e) {}
                }
            }

            // Hook SSL_get_verify_result — always return X509_V_OK (0)
            var verifyResult = m.findExportByName("SSL_get_verify_result");
            if (verifyResult) {
                try {
                    Interceptor.replace(verifyResult, new NativeCallback(function() { return 0; }, 'long', ['pointer']));
                    hooked++;
                } catch (e) {}
            }
        }

        console.log("[NativeTLS] Hooked " + hooked + " native SSL functions");
    }

    // Delay to let all libraries load
    setTimeout(applyNativeHooks, 3000);
    // Second pass for late-loaded libs
    setTimeout(applyNativeHooks, 8000);

    console.log("[NativeTLS] Native TLS bypass ready (hooks will apply in 3s)");
})();
