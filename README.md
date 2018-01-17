# disc-overall
The HARV 3000 manages the results and scoring for a flying disc overall tournament.

Sorry, no build support yet. Things to note:

1. This repo depends on disc-common, so you'll need that as well.

2. You may need to adjust the source links for .js and .css files in the web pages
once you've deployed them to your web content area.

3. You will need to change the function `sendRequest` in the file common.js (from
the disc-common repo) to make sure it can construct the correct URL for managing
data. The default implementation looks for a DDC or overall-related domain.
