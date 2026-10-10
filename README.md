# Bubble Grove

A touch-first word association game inspired by the core loop of Bubble Word Jam. Drag related bubbles together; four words make a thematic group. No ads, purchases, accounts, trackers, energy meters, or paid helpers.

Built with HTML, CSS, and JavaScript, with Vite bundling Rapier 2D soft-body physics, Anime.js, canvas-confetti, a local Nunito variable font, and original underwater artwork. Everything, including the physics WebAssembly, is hosted with the game and precached for offline play; the running game makes no requests to external CDNs. It is designed around the Galaxy S23's 360 × 780 CSS-pixel portrait viewport, with a compact layout for the space available under browser controls.

OpenAI Sites hosting is configured for [Bubble Grove](https://bubble-grove.xaroth.chatgpt.site). Open the hosted game in Chrome on your phone to install it. `.openai/hosting.json` retains this Site's identity for future updates.

## Vocabulary and picture clues

The game is about semantic ambiguity, not spotting repeated category labels. Prefer concise meaningful clues: a Bicycles pool uses **Mountain**, **Road**, **Electric**, and **Folding**, rather than repeating “bike.” Keep compounds or recognizable titles when removing a word would make the clue unfair. Themes still need at least four distinct clues; pop-culture pools stay focused. Shared words across themes are intentional.

Every entry in `PICTURES` must appear verbatim in at least one playable theme. An emoji supplies a word, so another sense of that word may be relevant (a bat picture can represent the sports tool). Picture selection is seeded and samples eligible clues rather than favoring the first mapped word. Do not replace split/locked or other special mechanics merely to force an image. A small stacked-special board can retain text if every mapped clue is obstructed.

New puzzles use the v6 seed namespace. Existing saves retain their stored clues and state. Keep existing theme IDs and append new packs after all earlier packs.

## Play locally

Install Node.js 22.12 or newer (Node.js 24 is recommended), then run:

```sh
npm ci
npm start
```

Open **http://localhost:4173** for Vite development. To try the actual offline PWA, run `npm run build` followed by `npm run preview`. Browser checks use that production bundle. Serve the project over HTTP rather than double-clicking `index.html`.

## Install on your Galaxy S23

1. Put the static game on an HTTPS host. GitHub Pages instructions are below. Any static HTTPS host works, including a host that serves it from a subdirectory.
2. Open that HTTPS address in **Chrome on your phone**.
3. Open game Settings and choose **Install Bubble Grove**, or use Chrome's **⋮ → Add to Home screen → Install**.
4. Open the **⋯** header menu and wait for **Ready for a little offline time**. Code, words, styles, artwork, fonts, libraries, and icons have then been cached.
5. Launch Bubble Grove from your home screen. Puzzles, practice, the full dictionary, settings, and saved progress work offline.

HTTPS is required for phone installation and offline caching. A computer's `localhost` preview is also eligible, but a plain HTTP address on your home network is not. See [MDN's installability requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) and [Chrome's Android installation instructions](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en).

### GitHub Pages

A manually triggered workflow is included; nothing is published automatically.

1. Push this project to your GitHub repository.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. In **Actions**, run **Publish Bubble Grove to GitHub Pages**.
4. The workflow checks the game, creates `dist/`, and publishes it. Open the address shown by the deployment on your phone.

For another host, run `npm run build` and upload the contents of `dist/`. Routes, imports, the manifest, and the service worker use relative addresses, so `/bubbles/` hosting works. Keep the project together; there is no backend.

## The game

- **Journey:** replayable levels with a fresh deck shuffle every time a level starts or restarts. The clues and mechanics stay tied to the level; its opening deal, waiting deck, and bubble placement vary between attempts. Resuming preserves the current board and shuffle. The first 14 introduce the mechanics. Regular decks contain 40–70 bubbles in total, starting with 24–26 live. Gentle puzzles have ten groups, Balanced puzzles fourteen, and Curious puzzles up to seventeen; some add a category transfer within the same limit. Small practice decks introduce individual mechanics. All levels are open; progress never gates play.
- **Daily:** one date-seeded board per local calendar day. Words and mechanics are independent of difficulty preferences. Each day has its own saved progress.
- **Free play:** generated boards with Gentle, Balanced, and Curious word pools. Every new round gets a new seed.
- **Bubble playground:** playable demonstrations of all 13 special mechanics, accessible from **? → Meet the special bubbles**. Practice preserves the Journey board.
- **Relaxed by default:** no move limit or clock. Optional Challenge mode adds a move budget to new puzzles. The burst bubble counts moves rather than time.
- **Falling bubbles:** openings and refills sprinkle words in one at a time, with gently varied timing, drop positions, and sideways drift. Waiting bubbles stay out of the physics world until released. Gravity, softer rebounds, and a little momentum settle the words into a pile at the bottom. Membranes wobble from impacts and flatten slightly under the weight of the pile; words remain steady. Hold a bubble under your finger and drop it onto a partner. Clearing four brings up to four word slots down from the top, mixed across themes instead of repeatedly supplying ready-made groups. Intermediate joins leave the reserve alone. The dealer always leaves at least one live group that can be completed, preparing any live shells or fragments first.
- **Physical membranes:** every bubble has 16 perimeter particles with elastic edges, bending constraints, area preservation, and shape matching. Rapier resolves contacts against the actual deforming surfaces, rather than a rigid circle. Smooth SVG curves follow those particles; labels retain their own layout. Pressure keeps bubbles inflated and damped springs restore their circular rest shape when contact is removed. The fixed 60 Hz simulation uses six solver iterations. Frozen and hardware-covered bubbles have firmer membranes; drag and failed-return control keeps the held center exact. There is no physical tearing or rupture threshold. Only completing a word group triggers the game's pop animation.
- **Quiet, visual feedback:** a failed join shakes and returns the dragged bubble to its original center, displacing anything that settled there. Successful joins draw the bubbles together. A completed four becomes a darker bubble displaying its category, then pops; a returning category appears at the same center. Touch input remains available throughout: begin another drag immediately after releasing, reuse a freshly merged bubble, or pick up a still-returning bubble. Detached snapshots animate the old words while the live board updates immediately. Merge and special-state changes show no toasts.
- **Living underwater garden:** an original painted reef, moving sunlight, glowing motes, swaying plants, and slow fish stay behind the bubbles. Dragging leaves water trails and a luminous connection near the drop target. Taps ripple, merges shed foam, and completed groups reveal their name with a golden halo before popping into tiny rising bubbles. Pops transfer a gentle water impulse to neighboring bubbles; walls, collisions, and dragging flex the membranes while labels stay readable.
- **Sea-glass interface:** cohesive teal, lavender, and sunset palettes; glossy highlights that follow bubble position; locally bundled rounded typography; spring motion for presses and arrivals; animated progress; glass menus, dialogs, and level cards. Frozen bubbles have progressively cracking ice; screw locks show a metal ring and individual Phillips heads. State changes shed themed particles. Reduced motion stops decorative animation, trails, and particles while retaining all illustrations and playable states.
- **Portrait play area:** the S23 uses its full 360 CSS-pixel width, fitting just under five ordinary bubbles across. The water fills all remaining portrait height below the top navigation and progress strip. Instructions, reserve counts, found-group chips, and the footer have been removed from the play screen.
- **Free helpers:** open the header's three-dot menu for Hint, Magnet, More room, Shuffle, Undo, and the word library. Hint reveals a theme and highlights its bubbles; Magnet completes an available group and triggers its keys/pins; More room deals extra words, resets burst counters, and grants five challenge moves. Shuffle drops the live bubbles again. Undo restores the last action during the current session.
- **Live bubble physics:** choose Bubble physics in that menu to replace the top HUD with Gravity, Pressure, and Damping sliders. Gravity controls falling, pressure controls resistance to squashing while preserving each bubble's nominal size, and damping controls how quickly jiggles settle. They update existing membranes without restarting the puzzle or using a move. Reset restores 100% defaults, Done returns to the game HUD, and preferences are saved on this device and work offline.
- **Two ways to combine:** drag one bubble onto another, or tap one and then tap its partner. Combined bubbles show every member term with a blank space between terms and no fraction counter. Half-word, one-, two-, three-, and four-term bubbles have fixed diameters of 54, 74, 108, 134, and 158 CSS pixels on the S23; narrower phones scale that whole size set proportionally. Each term's font size is fitted individually. Larger bubbles use darker shades. The category is revealed only when all four join, unless you ask for a Hint.
- **Ambiguous clues, fixed answers:** each deck contains a word only once, but the dictionary shares words across themes. Bass can belong with Guitar in one deck and Carp in another. Some later decks deliberately show clues for both meanings. Each puzzle has a fixed solution; a plausible word from another group remains a mismatch.
- **Runtime category transfers:** the deck builder discovers connections wherever a dictionary theme's name appears in another theme's word pool. It selects returning categories and fresh companion clues while assembling the deck, supporting chains up to three returns in Curious mode and changes of meaning such as Bass becoming a fish term. A word-allocation step keeps every clue unique, including shared clues, and routes cannot loop back into themselves. New dictionary memberships become available automatically without a separate list of chain templates. Existing saved puzzles retain their original words, routes, and theme names.
- **Personal touches:** three palettes, optional synthesized sounds, optional haptics on supported phones, and reduced motion. The OS's reduced-motion preference is respected.
- **Local progress:** each mode resumes independently. Settings includes JSON export and restore; restoring asks before replacing local progress. Browser data belongs to the device and site address, so export before clearing site data or moving to a different host.

## Special bubbles

| Mechanic | Behavior |
| --- | --- |
| Picture | An emoji represents a word; match its meaning. |
| Frozen | Four successful merges thaw the bubble, including partial and split-word joins. Ice fragments fall away and cracks deepen at every step; the final layer melts. Wrong guesses and hardware taps do not thaw ice. |
| Split word | Combine both fragments, in either order, before sorting the whole word. |
| Lock & key | Any successful merge involving a key consumes it and reveals the hidden word in its matching colored lock immediately, including partial and fragment joins. Wrong guesses leave keys intact. Several pairs can coexist, with distinct matching colors on their keys, lock icons, and rims. Locks enter the visible board before their keys are sprinkled in. |
| Screw | Two to five screwdrivers open a ring of the same color. Drag a screwdriver onto any other bubble to remove one matching screw, regardless of theme or whether the target is blocked. Each tool is used once. Unrelated words stay separate and incur no mistake; matching words also join normally. Using a tool spends one move. Rings arrive before their tools; tapping the ring does nothing. The final screw releases the ring. |
| Backward | Read the word right to left. |
| Linked | A real clue and a secret decoy move together within the playfield. Merging the real word pops the decoy, which belongs to no deck theme. |
| Burst | Complete its group before its nine-move countdown expires; thinking takes no time. |
| Theme bubble | Selected categories return as ordinary words, sometimes with another meaning, and can form a chain of returning categories. |
| Tangled | Kelp loosens when another group clears. |
| Pinned | Completing each green-pin group pulls one pin out; two pins release the bubble. |
| Dots | Letters hidden by dots emerge with every successful merge; joining the term reveals all its letters. |
| Bonus moves | Appears only with a move budget. The practice demo enables its own budget without changing your preference. |

The requested mobile mechanics and three helpers were researched through the [Google Play listing](https://play.google.com/store/apps/details?id=com.AppFore.BubbleWordJam) and publicly documented gameplay, including [key chains](https://levelsolve.com/bubble-word-jam/level/437/), [pinned locks](https://levelsolve.com/bubble-word-jam/level/532/), and [split words and octopus boards](https://levelsolve.com/bubble-word-jam/level/259/). Mobile and web editions differ. This implementation uses explicit, documented rules and original presentation and puzzles; it does not reproduce proprietary assets or level files.

## The dictionary

`src/data.js` contains **308 original themes, 2,433 word-to-theme associations, and 2,213 distinct words across 17 domains**. Domains cover nature, food, animals, space, science, home, style, sport, music, arts, travel, technology, games, language, everyday life, mathematics, and wordplay.

Each theme has at least four words; most have eight. A puzzle draws four and filters out words already used in that deck, including future category terms. Words remain reusable in other themes and other puzzles. Easy boards favor distinct subject areas; Curious boards include narrower concepts, proper names, and language connections. The whole collection is searchable through **The word library** in the game and remains available offline.

To add a theme, append a row to the data string:

```text
Theme name|domain|difficulty|First word,Second word,Third word,Fourth word,Other word
```

Use difficulty `1`, `2`, or `3` and at least four distinct words within that theme. Sharing words between themes is encouraged. Avoid commas within words. Run the checks after editing. Special-bubble decorations are independent of the word pools. The mixed dealer checks the live board before feeding the reserve so an available group is never stranded above the screen.

## Verify

```sh
npm test
npm run build
npm run check
```

The logic suite checks 300 Journey boards, 210 Free play boards, 300 more boards with randomized partial joins and clear orders, mixed-theme refills, deck size limits, every special demonstration, lock/key/pin dependencies, split assembly, category meaning changes, ambiguous fixed solutions, helpers, exhaustion and recovery, elastic collisions, weight deformation, deterministic generation, and save validation. Older oversized saves can shed untouched ordinary reserve groups while preserving every live clue, partial join, move, completed group, special, and category dependency. The asset check verifies the dictionary, offline asset list, manifest, and actual PNG icon dimensions.

Optional browser checks need Playwright and Chromium:

```sh
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
npm run test:interactions
npm run test:polish
npm run test:arrivals
npm run test:soft-bodies
npm run test:input-keys
npm run test:screws
npm run test:physics-controls
```

The browser script starts and stops its own local test server. It checks real touch-pointer dragging, gravity after release, growing word clusters, delayed category reveal, incoming reserve bubbles, taps, undo, reload/resume, practice, themes, library search, PWA icons, offline reload and play, and layouts at 360 × 780, 360 × 680, 393 × 852, and 320 × 640. It also saves phone and desktop screenshots in ignored `test-results/`. `PLAYWRIGHT_PATH`, `BROWSER_PATH`, and `TEST_URL` can point it at an existing installation or server.

The interaction check verifies impact wobble, weight deformation with steady labels, the expanded playfield, failed-drop return, merge animations, four-bubble reveal and pop, category rebirth at the same center, progressive size shading, four-stage thawing from partial and split-word joins, thaw progress after reload, individual screw removal, hidden-letter reveals from fragment joins, scenery layering, and reduced motion.

The arrival check verifies individually spaced opening and refill drops, varied entry positions, waiting bubbles excluded from collisions, cadence after a slow frame, mid-stream shuffle and save/restore, immediate reduced motion, and settled-board resume.

The input/key check verifies an immediate next drag while a merge is animating, reuse of newly merged targets, dragging during the category reveal, interruptible failed returns, overlapping four-word completions, undo cancellation, category rebirth during overlapping input, visible lock-before-key arrivals, distinct paired colors, partial-merge unlocks, consumed keys, color isolation, and saved unlock state. Existing saves retain their clues; old keys carried by multiword bubbles trigger their unlock once when loaded.

The screw check verifies five distinct heads, colored screwdriver illustrations spread across themes, unrelated and matching partners, direct use on a blocked ring, visible ring-before-tool arrivals, immediate touch input, undo, saved and offline screw progress, ordinary key isolation, and reduced motion. Unit tests also cover single, pair, and triple partners in either direction; color isolation; frozen, keyed, tangled, pinned, fragment, decoy, and bonus targets; preservation of every clue; one-time tool consumption; and ordinary wrong-merge behavior. Legacy screw saves gain matching tools on existing clues without changing the word ledger, moves, or solved groups. If a late legacy save has no other clues left to carry tools, its ring opens so the remaining group stays playable.

The physics-controls check exercises native touch sliders, immediate gravity changes on live bubbles, continued dragging, HUD replacement, reset, preserved clues/moves, 320–393px portrait layouts, Done/Escape, and offline saved preferences. Physics tests compare pressure-dependent compression and damping-dependent recovery and check a full pile at the heavy/squishy extremes.

The polish check verifies actual canvas movement, drag trails, particle bursts, local font loading, readable color contrast in all three palettes, still scenery in reduced-motion mode, and offline reload with bundled art, fonts, and libraries. Canvas resolution and particle lifetimes are bounded; scenery runs at 30 frames per second and stops when the page is hidden. The complete offline asset set is about 3.9 MB before transfer compression; the main JavaScript and embedded physics WebAssembly transfer in about 1.36 MB with gzip and are then cached locally.

The soft-body browser check exercises a full S23-sized pile, real changing membrane contours, steady text, touch holding and release, and offline WebAssembly initialization. It measures a five-second interaction at four times CPU slowdown and records the frame distribution in `test-results/soft-body-performance.json`. This emulates a slower browser CPU; it is not a benchmark of a physical Galaxy S23. Physics unit checks cover surface nonpenetration, area retention, pressure under a pile, recovery to round, mixed bubble sizes, return displacement, wall resize, and impulses.

Libraries: [Rapier soft bodies](https://rapier.rs/docs/user_guides/javascript/soft_bodies/), [Anime.js](https://animejs.com/documentation/animation/), and [canvas-confetti](https://github.com/catdad/canvas-confetti). Their licenses and the font license ship in `THIRD-PARTY-NOTICES.txt`. The original image and generation prompt are documented in [assets/ARTWORK.md](assets/ARTWORK.md).

Checks use browser emulation; installation and haptics should also be tried on the physical phone after hosting.

## Files and maintenance

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Responsive app shell and bubble appearance |
| `src/app.js` | Touch controls, bubble positioning, dialogs, sound, saves, and installation |
| `src/nesting.js` | Runtime dictionary routes and allocation of unique nested clues |
| `src/engine.js` | Deterministic puzzles, merge rules, special mechanics, and save validation |
| `src/physics.js` | Rapier elastic membranes, surface collisions, pressure, shape recovery, and held-bubble handling |
| `src/data.js` | Original theme pools, image mappings, and special-bubble guide |
| `src/art.js` | Original underwater scenery and illustrated bubble hardware |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installation and complete offline caching |
| `scripts/` | Vite build, static server, checks, and optional browser/icon tools |

The build fingerprints all precached content and emits a matching service worker. Its install step caches the complete asset set before activation, then removes only old Bubble Grove caches. An installed copy reloads automatically after the new worker activates. Saved puzzle groups, shuffle seeds, partial joins, and progress stay intact. If generation rules change incompatibly, increment the seed version and/or save schema rather than silently changing an existing board.

MIT licensed. See `LICENSE`.

The special-bubble refinement check (`node scripts/specials-check.mjs`) covers linked-pair boundaries in both motion modes, secret decoy pops, lock-word concealment and reveal, kelp and pin release animations, two-step category returns, demo-only bonus move budgets, migration of retired mechanics, and offline play.
