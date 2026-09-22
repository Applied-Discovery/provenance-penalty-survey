# Curation criteria: example_image domain

The eight artifacts in this domain are placeholder images generated for this
repository: one human and one AI placeholder at each of four shapes — a
landscape (`h0.png`, `a0.png`, 1600x900), a tall portrait (`h1.jpg`,
`a1.jpg`, 600x1800), a square (`h2.png`, `a2.png`, 1000x1000) and a small
landscape (`h3.jpeg`, `a3.jpeg`, 800x600). They exist only to exercise the
image pipeline: the three supported formats, the preload step, and the
display box that keeps a tall image from pushing the rating scale off screen.
They were not curated against any selection criteria, are not drawn from a
real human or AI population, and must never be treated as, or included in, a
study pool.

The two halves of each pair share a shape and a format deliberately. An image
is shown at its own aspect ratio and is never upscaled, so intrinsic size and
file format are visible to the rater: a pool whose AI half is uniformly
1024x1024 PNG and whose human half is 4032x3024 JPEG hands the rater a
provenance cue that has nothing to do with the artifact. Real curation keeps
dimensions, aspect ratios and formats comparable across the human and AI
halves.

A real domain replaces this entire file with the frozen curation criteria
for its actual artifact pool (selection rules, source, date range, exclusion
rules, etc.), and that file — together with the domain's `domainManifest.json`
and artifacts — is uploaded to OSF and frozen before data collection begins,
per `02_design/BENCHMARK.md`.
