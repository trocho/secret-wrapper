#import <Foundation/Foundation.h>
#import <Security/Security.h>
#include <string.h>

static int fail(OSStatus status) {
    CFStringRef message = SecCopyErrorMessageString(status, NULL);
    fprintf(stderr, "Secret Wrapper could not update macOS Keychain: %s (%d)\n",
        message ? [(__bridge NSString *)message UTF8String] : "unknown Keychain error", (int)status);
    if (message) {
        CFRelease(message);
    }
    return 1;
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 3 && argc != 4) {
            fprintf(stderr, "usage: macos-keychain-writer SERVICE ACCOUNT [--if-missing]\n");
            return 64;
        }

        NSString *serviceName = [NSString stringWithUTF8String:argv[1]];
        NSString *accountName = [NSString stringWithUTF8String:argv[2]];
        NSData *password = [[NSFileHandle fileHandleWithStandardInput] readDataToEndOfFile];
        BOOL ifMissing = argc == 4 && strcmp(argv[3], "--if-missing") == 0;
        if (argc == 4 && !ifMissing) {
            fprintf(stderr, "unknown option: %s\n", argv[3]);
            return 64;
        }
        NSDictionary *query = @{
            (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
            (__bridge id)kSecAttrService: serviceName,
            (__bridge id)kSecAttrAccount: accountName,
        };
        NSDictionary *attributes = @{(__bridge id)kSecValueData: password};
        NSMutableDictionary *newItem = [query mutableCopy];
        [newItem addEntriesFromDictionary:attributes];
        OSStatus status;

        if (ifMissing) {
            status = SecItemAdd((__bridge CFDictionaryRef)newItem, NULL);
            if (status == errSecDuplicateItem) {
                return 3;
            }
        } else {
            status = SecItemUpdate((__bridge CFDictionaryRef)query, (__bridge CFDictionaryRef)attributes);
            if (status == errSecItemNotFound) {
                status = SecItemAdd((__bridge CFDictionaryRef)newItem, NULL);
                if (status == errSecDuplicateItem) {
                    status = SecItemUpdate((__bridge CFDictionaryRef)query, (__bridge CFDictionaryRef)attributes);
                }
            }
        }
        return status == errSecSuccess ? 0 : fail(status);
    }
}
