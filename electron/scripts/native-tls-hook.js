/**
 * Trafexia Universal SSL Unpinning Script
 * Version: 3.4 — Minimalist (Shopee Focused)
 * Fix: Removed heavy proxies and global hooks to prevent ANR/Timeout
 */

(function () {
    'use strict';
    const g = globalThis;
    const FModule = g.Module;
    const FProcess = g.Process;
    const FInterceptor = g.Interceptor;
    const FJava = g.Java;

    const TAG = "[Trafexia]";
    const log = (msg) => console.log(`${TAG} ${msg}`);

    log("=== Shopee Minimalist Bypass v3.4 Loaded ===");

    // ─────────────────────────────────────────────────────────────────
    // 1. NATIVE TLS (Tập trung vào Shopee Core)
    // ─────────────────────────────────────────────────────────────────
    const SHOPEE_LIBS = ["libshopee.so", "libnetwork.so", "libmsf.so", "libssl.so", "libcrypto.so", "libboringssl.so", "libcronet.so"];
    const SSL_HOOKS = [
        "SSL_set_custom_verify", "SSL_CTX_set_custom_verify", 
        "SSL_verify_peer_cert", "ssl_verify_peer_cert",
        "SSL_CTX_set_verify", "SSL_set_verify"
    ];

    function hookLib(name) {
        try {
            const m = FProcess.findModuleByName(name);
            if (!m) return;
            log(`Hooking ${name} @ ${m.base}`);
            SSL_HOOKS.forEach(h => {
                const addr = FModule.findExportByName(name, h);
                if (addr) {
                    try {
                        FInterceptor.replace(addr, new NativeCallback(() => 0, 'int', ['pointer', 'int', 'pointer']));
                        log(` [+] ${h} bypassed`);
                    } catch (e) {}
                }
            });
        } catch (_) {}
    }

    SHOPEE_LIBS.forEach(hookLib);

    // ─────────────────────────────────────────────────────────────────
    // 2. JAVA LAYER (Delay 2s, Minimalist)
    // ─────────────────────────────────────────────────────────────────
    if (FJava && FJava.available) {
        setTimeout(() => {
            FJava.perform(() => {
                log("Java hooks starting...");
                
                // TrustAllManager - Bản rút gọn nhất
                try {
                    const X509TM = FJava.use("javax.net.ssl.X509TrustManager");
                    const SSLCtx = FJava.use("javax.net.ssl.SSLContext");
                    const TM = FJava.registerClass({
                        name: "com.trafexia.bypass.TrustAllManager",
                        implements: [X509TM],
                        methods: {
                            checkClientTrusted(chain, authType) {},
                            checkServerTrusted(chain, authType) {},
                            getAcceptedIssuers() { return []; }
                        }
                    });
                    const ctx = SSLCtx.getInstance("TLS");
                    ctx.init(null, [TM.$new()], null);
                    SSLCtx.setDefault(ctx);
                    log(" [+] TrustAllManager installed");
                } catch (_) {}

                // OkHttp3 - Bypass CertificatePinner đơn giản
                try {
                    const CP = FJava.use("okhttp3.CertificatePinner");
                    CP.check.overloads.forEach(o => {
                        o.implementation = function() { return; };
                    });
                    log(" [+] OkHttp3 Pinner bypassed");
                } catch (_) {}

                // Network Security Config
                try {
                    const NST = FJava.use("android.security.net.config.NetworkSecurityTrustManager");
                    NST.checkPins.implementation = function() {};
                    log(" [+] NetworkSecurityConfig bypassed");
                } catch (_) {}

                log("=== Java hooks complete ===");
            });
        }, 2000);
    }
})();