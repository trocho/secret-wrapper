# Security policy

## Supported version

Security fixes are applied to the latest stable release of `@trocho/secret-wrapper`. Upgrade to the current npm `latest` version before reporting behavior from an older release.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/trocho/secret-wrapper/security/advisories/new). Do not open a public issue containing a credential, provider export, authentication response, environment dump, real selector, or private infrastructure detail.

Include the affected version, operating system, provider, minimal sanitized command shape, expected behavior, observed behavior, and reproduction steps. Replace every value and provider locator with an unmistakable placeholder.

## Security boundary

Secret Wrapper keeps credential values out of MCP configuration, `.env` files, shell history, and its own debug output. It resolves configured values immediately before launch and exposes them only to the target child process. Provider authentication variables are removed from the child environment.

The optional authorization form binds to `127.0.0.1`, uses a random one-time path, disables caching and referrers, restricts page capabilities with Content Security Policy, never renders existing values, and accepts credentials through password inputs. Submitted values are opaque data: agents must not inspect or automate the fields, request body, provider state, or child environment.

Secret Wrapper does not protect a compromised host, an untrusted target executable, a malicious provider CLI, or a credential after the target process receives it. Provider login, access control, rotation, and audit remain the provider owner's responsibility.
