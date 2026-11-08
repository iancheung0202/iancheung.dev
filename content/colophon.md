+++
title = "colophon"
description = "How iancheung.dev is made: type, colour, icons, and the rules that keep it consistent."
template = "colophon.html"
+++

<p class="aside">Draft. The facts are right, the voice is not mine yet.</p>

This page is the rulebook for the site. If something on another page breaks a rule here, the page is wrong, not the rule.

## type

Six families, each with exactly one job. No family is ever used for another family's job.

{% specimen(token="display", name="Poppins", role="my name, nav, page titles, headings") %}Ian Cheung<br>growing up in hong kong{% end %}
{% specimen(token="section", name="Crowd Pleaser", role="the big section titles on the home page, nothing else") %}about me{% end %}
{% specimen(token="body", name="Open Sans", role="paragraphs, lists, tables, buttons", class="small") %}I was born and raised in Hong Kong. I was relatively surprised by how little people know about the history of and way of life in Hong Kong.{% end %}
{% specimen(token="tree", name="Atkinson Hyperlegible Next", role="page names in the story and class explorers", class="tree") %}welcome to my story<br>growing up in hong kong<br>contact me{% end %}
{% specimen(token="hand", name="Caveat", role="anything handwritten: notes on the wall") %}hi ian, nice wall{% end %}
{% specimen(token="stamp", name="Doto", role="timestamps, photo captions, access codes") %}2026-11-07 13:08 PST{% end %}
{% specimen(token="mono", name="system monospace", role="code, and body text in nerd mode", class="small") %}zola build && python3 main.py{% end %}

Rules:

- Headings are Poppins. Always. Including headings inside story pages and class notes.
- Nerd mode (the `</>` button) swaps body text to monospace and nothing else. Headings, nav, section titles and names in the explorer stay as they are. It is remembered across pages.
- No new families. If something needs emphasis, use weight or size within these six.

## colour

One accent, a small set of neutrals, nothing else. Components never introduce their own colours.

{{ swatches(tokens="green, green-ink, green-tint, paper, surface, ink, ink-muted, ink-faint, line, code-bg") }}

- `green` is the accent, for underlines, active states, the odd highlight. `green-ink` is the same green dark enough to read as text on paper.
- `paper` is the page, `surface` is anything that sits on the page (cards, dialogs, editor panes).
- Light mode keeps today's values exactly. Dark mode keeps the hue of the green but lowers its saturation so it stops glowing on black.

### the dark green (decision pending)

Click a candidate to preview it on this page in dark mode. The site currently uses B. The choice is Ian's.

{{ green_candidates() }}

## icons

[Phosphor](https://phosphoricons.com/), regular weight, inlined as SVG at build time from one JSON file of the whole set (`static/icons/phosphor-regular.json`), so any icon name works in templates and in the story editor. One weight everywhere. Emoji appear only where I typed them into content.

## photos

The background photos are mine.

## stack

Pages are markdown, built by [Zola](https://www.getzola.org/) into plain HTML. A small [Flask](https://flask.palletsprojects.com/) server serves the build and handles the parts that need a server: the wall, the one-time codes, and the editor I use to write the story pages. Fonts come from Google Fonts, except Crowd Pleaser and Atkinson Hyperlegible Next, which are served from here.

Source: [github.com/iancheung0202/iancheung.dev](https://github.com/iancheung0202/iancheung.dev).
