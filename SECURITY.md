# Security Policy

Hive is currently under private development. Do not report security issues through public GitHub issues.

Security-sensitive configuration must be stored outside source control. Production secrets will use the selected hosting provider's managed secret store.

Initial security controls include:

- environment-based configuration
- dependency scanning in CI
- static analysis
- strict API boundaries
- no default production credentials
- planned device authentication and credential rotation before field deployment
