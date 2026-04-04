Original prompt: Look trough this repo. Make improvements. Increase robustness. Fix errors.

- Replaced the previous `script.js` with a smaller state-driven implementation to remove broken global listeners, undefined handlers, and inconsistent custom-board logic.
- Cleaned `index.html` to remove inline script/style blocks that referenced missing DOM nodes and moved footer styling fully into `styles.css`.
- Added defensive UI behavior for missing leaderboard DOM, localStorage failures, network failures, and popup/reset/timer lifecycle.
- Browser validation status: the Playwright client now loads the page, clicks into the board, produces screenshots/state JSON, and reports no console/page errors.
- Follow-up hardening after the first browser pass: popup state text now clears correctly when hidden, and custom mine limits update as the custom board size changes.
- UI follow-up after screenshot review: increased popup contrast so win/loss states are visually obvious instead of blending into the page overlay.
- TODO: Keep the temporary Playwright/module setup out of commits; it was only used for validation.
