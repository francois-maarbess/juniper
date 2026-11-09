---
name: Expo preview startup
description: Cold-start timing when previewing a newly created Expo artifact.
---

The Expo workflow can open its preview port before the first Metro web bundle has finished compiling. A screenshot taken immediately after workflow restart may capture a blank page even though bundling completes successfully shortly afterward.

**Why:** The initial bundle took roughly 18 seconds in this environment; the port became available before the browser had rendered the app.

**How to apply:** After restarting a new Expo workflow, wait until the workflow logs show the first `Web Bundled` completion before taking the single first-build preview screenshot.
