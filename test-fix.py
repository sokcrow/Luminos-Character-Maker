import re

with open('tests/test_hud.spec.js', 'r') as f:
    content = f.read()

# Replace the path so it actually loads correctly from the refactored layout if needed
# Actually, the problem is likely that the script modules aren't being loaded over the `file://` protocol.
# ES modules (`<script type="module">`) are blocked by CORS on `file://` URLs.
# We can spin up a local server to serve the files, then point playwright to localhost.
