+++
title = "colophon"
description = "How iancheung.dev is made."
template = "colophon.html"
+++

What this site is made of. If a page disagrees with this list, the page is wrong.

## type

Six typefaces, one job each.

{% specimen(token="display", name="Poppins", role="my name, the nav, page titles, headings") %}Ian Cheung<br>growing up in hong kong{% end %}
{% specimen(token="section", name="Crowd Pleaser", role="the big section titles (about me, my notes) and nothing else") %}about me{% end %}
{% specimen(token="body", name="Open Sans", role="paragraphs, lists, buttons, the activity card", class="small") %}I was born and raised in Hong Kong. I was relatively surprised by how little people know about the history of and way of life in Hong Kong.{% end %}
{% specimen(token="tree", name="Atkinson Hyperlegible Next", role="page names in the story and class explorers", class="tree") %}welcome to my story<br>growing up in hong kong<br>contact me{% end %}
{% specimen(token="hand", name="Caveat", role="handwriting: the notes on the wall") %}hi ian, nice wall{% end %}
{% specimen(token="stamp", name="Doto", role="timestamps and access codes") %}2026-11-07 13:08 PST{% end %}
{% specimen(token="mono", name="system monospace", role="code, and all body text when nerd mode is on", class="small") %}zola build && python3 main.py{% end %}

Poppins, Open Sans, Caveat and Doto come from Google Fonts; Crowd Pleaser and Atkinson Hyperlegible Next are served from here.

## colour

{{ swatches(tokens="accent, accent-bright, accent-fill, on-accent, paper, surface, ink, ink-muted, ink-faint, line") }}

- `accent` is navy in light mode and green in dark mode. It marks section labels, links, the explorer marker, focus rings and anything selected. There is no second colour: light mode is blue, dark mode is green.
- `accent-bright` is the same colour with the lights on, for things that sit over the header photo (the active nav link, the three toggles) and the terminal prompt. In dark mode it is the green itself, less saturated so it does not glow on black.
- `accent-fill` with `on-accent` is the one filled button (Stick it on the wall, the login): navy with white text in light mode, green with dark text in dark mode.
- `paper` is the page. `surface` is anything sitting on it: the activity card, the dialogs, the editor.
- Light mode and dark mode are the same site with these values swapped. The choice is remembered, as are nerd mode and music.

## icons

[Phosphor](https://phosphoricons.com/), regular weight, inlined as SVG at build time. Emoji only where I typed them into the content.

## photos

The background photos are mine.

## stack

Pages are markdown built by [Zola](https://www.getzola.org/). A small [Flask](https://flask.palletsprojects.com/) server serves the build and does the parts that need a server: the wall, the one-time codes, the editor I write the story pages in, the activity card (my Discord presence) and the message box on the home page, which signs you in with Discord and posts to a private channel of mine.

Everything runs in one Docker container on a VPS. A push to `main` builds the image, smoke-tests it and deploys it.

Source: [github.com/iancheung0202/iancheung.dev](https://github.com/iancheung0202/iancheung.dev).
