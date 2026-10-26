# DOTA SPY

A local game of Spy with Dota 2 heroes or items. 3–12 players, one shared card, and one or two randomly assigned spies. No accounts or database.

## Run in VS Code

1. Open this folder in VS Code.
2. Open **Terminal → New Terminal**.
3. Run `npm start`.
4. Open **http://localhost:3000**.

Requires Node.js 18 or later. No `npm install` is needed. If PowerShell blocks `npm.ps1`, use `npm.cmd start` or `node server.mjs`. Stop with Ctrl+C.

The lobby has a looping React carousel for the selected Heroes or Items mode. Cards advance every 1.3 seconds with a 1.15-second transition. Its production bundle and images are included locally, so normal play needs no build step or internet access. Animation continues on hover, pauses in hidden tabs and catalog pages, and respects reduced-motion settings. To edit the component, change `src/hero-carousel.jsx`, run `npm install` once, then `npm run build:carousel`.

You can also press **F5** and choose **DOTA SPY — start site**.

If port 3000 is busy, run `$env:PORT=3001` followed by `npm.cmd start`, then open port 3001. The server listens only on your computer; friends can watch your screen share.

## Play

Choose **Heroes** or **Items**, enter player names, choose **1 spy** or **2 spies** and the reveal time, then start. Each player gets a 3-second countdown before their role appears for 3, 5, or 7 seconds. Roles hide automatically. Move to the next player manually.

Everyone on the team sees **the same hero or item**, according to the selected mode. The selected number of players see **Spy**, without the card's name, picture, or the identity of the other spy. The card and spies stay hidden during discussion.

During screen sharing, only the named player should look at the screen. Everyone else, including the host if they are playing, must look away. A shared screen cannot hide a card from individual viewers. **Esc**, switching tabs, or losing focus hides the role immediately; the player can reveal it again.

Discuss the hero or item without naming it. Agree on a winner, then choose **Team** or **Spy / Spies** and confirm. A team win awards +1 to each team member. A spy win awards +1 to each spy. The result reveals the card and all spies. The app does not judge spoken answers. Your spy-count setting is kept for the next round, rerolls, and redeals.

A crown beside a name in **Scores** marks who starts the discussion. This player is chosen randomly each round, independently of the spy. **Randomize** moves the crown to another random player without changing roles or scores.

The Minecraft parkour video below **Scores** autoplays muted and loops. Playback continues across role reveals and rounds. Use its controls to pause, seek, or change the volume. The video is stored locally in `public/assets/videos/parkour.mp4`.

Three reaction buttons below the game play a punch, laugh, or cartoon fart sound with a brief translucent emoji overlay. Repeated clicks replace the previous sound. Esc stops reactions; switching tabs, leaving the game page, or starting a new game stops them too. Sounds are stored locally; source links and license details are in `public/assets/sounds/SOURCES.md`. To rebuild the React carousel and reactions, run `npm run build:carousel`.

**Next round** keeps names and scores, chooses a different card from the same mode, and randomly assigns the spy again. **Reroll hero / item** changes the hidden card before the deal. **Redeal** restarts the current round with another card and newly assigned spies, without changing scores; everyone must view their role again. **New game** resets scores and returns to the name form.

Names, roles, and scores stay only in page memory. Reloading or closing the page resets the game. No cookies, localStorage, or saved history.

## Items

**Items** contains the full current gameplay pool: **259 items** — 188 shop items (including components and consumables), 49 neutral items, and 22 obtainable world or hero items such as Aegis, Cheese, lotuses, and Roshan drops. Recipes, removed items, event/debug objects, couriers, and neutral enhancements are excluded. Dagon levels have separate English labels to distinguish their cards.

Names, IDs, and prices come from the official [Valve item datafeed](https://www.dota2.com/datafeed/itemlist?language=english). Shop availability and obsolete flags come from [Valve's game definitions mirrored by SteamDatabase](https://github.com/SteamDatabase/GameTracking-Dota2/blob/master/game/dota/pak01_dir/scripts/npc/items.txt); active neutral tiers come from the Valve datafeed. All icons are stored locally in `public/assets/items/`. **All items** opens the searchable catalog. Browsing the catalog does not change the game mode.

`public/items.json` records the sources, scope, categories, and fetch date. `valve-items-source.json` keeps the full source roster with availability flags, so completeness can be checked. Run `npm run update:items` to refresh the full catalog and download missing images. The existing catalog is replaced only after every included image is verified. To regenerate from the included snapshot, run `node scripts/update-items.mjs --from-snapshot`.

## Heroes and portraits

The included catalog has **127 heroes**, including Largo, Kez, Ringmaster, and Muerta, fetched from the official [Valve datafeed](https://www.dota2.com/datafeed/herolist?language=english). Names and portraits are matched using Valve's internal hero names.

All PNG portraits are stored in `public/assets/heroes/`, so the game works offline. `public/heroes.json` records names, IDs, local paths, source URLs, and the download timestamp from the computer's system clock.

Run `npm run update:heroes` (or `npm.cmd run update:heroes`) to refresh the catalog and download new portraits. Updating needs internet access. Reload the page afterward. The catalog is replaced after all portraits have downloaded successfully.

This is an unofficial fan project. Dota 2 and its artwork belong to Valve.

## Checks

- `npm test` checks roles, scoring, rerolls, name validation, full item-pool coverage, and every local hero/item image.
- `node --check public/app.js` checks interface syntax.

## Files

- `public/index.html`, `public/styles.css`, `public/app.js`: interface.
- `public/game.js`: role assignment and scoring.
- `public/heroes.json`, `public/assets/heroes/`: local catalog and portraits.
- `scripts/update-heroes.mjs`: catalog and portrait updater.
- `server.mjs`: local Node.js HTTP server.

The game is intended for casual play. Someone using browser developer tools can inspect roles in page memory.
