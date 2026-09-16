---
"@awc-ui/core": patch
---

Generate component label, description, tab and overlay IDs with Web Crypto instead of truncated Math.random values, with a unique counter fallback for server rendering environments without Web Crypto.
