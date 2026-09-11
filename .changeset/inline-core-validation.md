---
"@awc-ui/core": patch
---

Show constraint validation in each control's own inline error styling instead of the browser validation popover. Required, type, pattern and custom validity continue to block submission. Core submit buttons, Enter submission and control reportValidity focus the first invalid field; generated messages clear after correction or reset without overwriting app-provided errors.
