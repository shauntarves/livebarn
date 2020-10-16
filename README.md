# livebarn
A Javascript library for fetching videos from the LiveBarn streaming service.

## Options

The Livebarn 2.0 API supplies videos in very small (~20s) chunks, and this library is designed to concatenate all chunks downloaded for a given range of time into a single output video. However, this requires the user have `ffmpeg` installed locally. There is an optional flag to disable the processing of videos, which, if set, will skip the `ffmpeg` step and return an ordered list of the downloaded chunks for later use outside of this library.

##### `username`
Your livebarn.com username. _Required._
##### `password`
Your livebarn.com password. _Required._
##### `uuid`
Your livebarn.com user uuid (this can be determined by looking inspecting web requests in the browser after logging in to livebarn.com). _Required._
##### `feedMode`
The desired feed to download: `4` = panoramic, `5` = auto. _Default: `5`._
##### `outputDir`
The location of output files. This directory will be created in the current path. _Default: `videos`._
##### `workDir`
The location of downloaded chunk files and any intermediate merge files (see `maximumChunksPerMerge`). This directory will be created in the current path. _Default: `tmp`._
##### `cleanup`
Set to false to keep all temporary files after merging is complete. _Default: `true`._
##### `skipDownload`
Indicates whether to skip downloading video chunks, which may be useful if merge step fails and you want to re-attempt merging. _Default: `false`._
##### `format`
The video format used by livebarn. _Default: `ts`._
##### `maximumChunksPerMerge`
The limit on the number of video chunk files that will be merged per `ffmpeg` _merge_ command. _Default: `60`._

Note: If ffmpeg gives you errors during the merge process, try adjusting this number to find the sweet spot. For example, PANO (`feedMode: 4`) uses higher resolution chunks, so this limit should be adjusted accordingly if using that feed mode.
##### `skipMerge`
Indicates whether to skip merging video chunks after download, which is useful if `ffmpeg` isn't installed. _Default: `false`._

## Example
The example provided in demonstrates how to download, and optionally, concatenate video segments from a Livebarn _surface_ over a certain timeframe.

```
const livebarn = require('./index');

// known surfaces
const _surfaces = {
  canton1: new livebarn.Surface(993),
  canton2: new livebarn.Surface(994),
};

// dates in the livebarn media API appear to track Eastern time, but since we leverage Date.toJSON(),
// which prints the date in UTC, we mock our date/time as being in UTC
// reminder: month starts at 0!
const games = [
  new livebarn.Game(_surfaces.canton1, new Date(Date.UTC(2020, 6, 15, 14, 50, 00)), 80, 4),
  new livebarn.Game(_surfaces.canton1, new Date(Date.UTC(2020, 6, 15, 14, 50, 00)), 80, 5),
];

// The fetch command accepts an array of game objects or a single game object.
livebarn.fetch(games, {
  username: "",
  password: "",
  uuid: "",
}).catch(e => {
  console.error(e.message)
});

## `ffmpeg` Bonus
MPEG-2 Transport Stream files (`.ts`) aren't supported by many video tools, like iMovie, for example. If you want to convert the final `.ts` file into an H.264 + AAC format, use the following command:
```
ffmpeg -i file:input.ts -c:v libx264 -c:a aac output.mp4
```
