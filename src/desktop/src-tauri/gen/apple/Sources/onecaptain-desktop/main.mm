#include "bindings/bindings.h"
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>

static UIColor *onecaptainLightColor(void) {
    return [UIColor colorWithRed:0.929 green:0.910 blue:0.871 alpha:1.0];
}

static UIColor *onecaptainDarkColor(void) {
    return [UIColor colorWithRed:0.063 green:0.051 blue:0.039 alpha:1.0];
}

static NSString *const kThemeObserverScript =
    @"(function(){"
    "if(window.__onecaptainThemeObserverInstalled)return;"
    "window.__onecaptainThemeObserverInstalled=true;"
    "function sync(){var d=document.documentElement.classList.contains('dark');"
    "window.webkit.messageHandlers.onecaptainTheme.postMessage(d?'dark':'light');}"
    "sync();"
    "new MutationObserver(sync).observe(document.documentElement,"
    "{attributes:true,attributeFilter:['class']});"
    "})();";

@interface OneCaptainThemeHandler : NSObject <WKScriptMessageHandler>
@property (nonatomic, weak) UIViewController *viewController;
@end

@implementation OneCaptainThemeHandler

- (void)userContentController:(WKUserContentController *)userContentController
      didReceiveScriptMessage:(WKScriptMessage *)message {
    if (![message.name isEqualToString:@"onecaptainTheme"]) return;
    NSString *theme = message.body;
    BOOL isDark = [theme isEqualToString:@"dark"];
    dispatch_async(dispatch_get_main_queue(), ^{
        self.viewController.view.backgroundColor = isDark ? onecaptainDarkColor() : onecaptainLightColor();
    });
}

@end

@implementation UIViewController (OneCaptainSafeArea)

+ (void)load {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        Method original = class_getInstanceMethod(self, @selector(viewDidLayoutSubviews));
        Method swizzled = class_getInstanceMethod(self, @selector(onecaptain_viewDidLayoutSubviews));
        method_exchangeImplementations(original, swizzled);
    });
}

- (void)onecaptain_viewDidLayoutSubviews {
    [self onecaptain_viewDidLayoutSubviews];
    UIEdgeInsets insets = self.view.safeAreaInsets;
    for (UIView *subview in self.view.subviews) {
        if ([subview isKindOfClass:[WKWebView class]]) {
            CGRect bounds = self.view.bounds;
            subview.frame = CGRectMake(
                insets.left,
                insets.top,
                bounds.size.width - insets.left - insets.right,
                bounds.size.height - insets.top - insets.bottom
            );

            WKWebView *webView = (WKWebView *)subview;
            static dispatch_once_t scriptToken;
            dispatch_once(&scriptToken, ^{
                OneCaptainThemeHandler *handler = [[OneCaptainThemeHandler alloc] init];
                handler.viewController = self;
                [webView.configuration.userContentController
                    addScriptMessageHandler:handler name:@"onecaptainTheme"];
                WKUserScript *script = [[WKUserScript alloc]
                    initWithSource:kThemeObserverScript
                    injectionTime:WKUserScriptInjectionTimeAtDocumentEnd
                    forMainFrameOnly:YES];
                [webView.configuration.userContentController addUserScript:script];
            });

            BOOL isDark = (self.traitCollection.userInterfaceStyle == UIUserInterfaceStyleDark);
            self.view.backgroundColor = isDark ? onecaptainDarkColor() : onecaptainLightColor();
        }
    }
}

@end

int main(int argc, char * argv[]) {
	ffi::start_app();
	return 0;
}
