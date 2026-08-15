# Vorvex visual system

## Product intent

Vorvex is one continuous financial environment. The Aurora owns the full viewport; Worlds and their objects retain stable spatial identities while the viewpoint changes. Information arrives only after travel settles and disappears from both the screen and accessibility tree when closed.

## Typography

Use the native system UI stack (`-apple-system`, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial). It gives Vorvex excellent small-text rendering without a font download, remains familiar rather than artificially futuristic, and performs well in the local runtime.

- Financial values use tabular lining numerals so balances remain stable while changing.
- Primary values and World names carry the hierarchy; metadata is never smaller than 12px on desktop.
- Important account and category names wrap. Truncation is reserved for genuinely constrained layouts.
- Normal text targets WCAG 2.2 AA contrast of at least 4.5:1; large text targets at least 3:1 against its resting rendered surface.

This follows Apple’s current guidance to prefer legible system fonts, avoid unnecessary typeface mixing, test text against its actual material/background, and meet AA contrast guidance: [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).

## Color and glass

The semantic palette is governed by `--vx-*` tokens in `app/globals.css`. White and neutral text communicate the financial facts; World accents establish identity. Positive and negative movement always includes a sign or word, never color alone. Glass surfaces use a dark dimming layer so Aurora color cannot compromise legibility.

## Motion

The shared lifecycle is travel → deceleration → arrival → information. World, object, navigation, and surface transitions use the same duration and easing. Reduced-motion preferences collapse travel to an effectively immediate state. Calm resting objects do not continuously float or jitter.

The motion model follows Apple’s guidance to keep custom spatial movement gentle, avoid distracting peripheral motion, and respect reduced-motion preferences: [Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [Accessible appearance](https://developer.apple.com/documentation/swiftui/accessible-appearance).
