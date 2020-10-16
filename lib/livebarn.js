/**
 * External dependencies
 */
const fs = require("fs");
const path = require("path");
const url = require("url");
const crypto = require("crypto");
const ffmpeg = require("fluent-ffmpeg");

/**
 * Internal dependencies
 */
const { Client } = require("./client");
const { Game } = require("./game");
const { Surface } = require("./surface");
const { MediaListRequest } = require("./mediaListRequest");
const { ChunkRequest } = require("./chunkRequest");
const { chunk, getPathForUri, createDirectory, matchUrls } = require("./utils");

// the default options for video retrieval
const _defaultOptions = {
  feedMode: 5, // 4 = pano, 5 = auto
  outputDir: "videos", // this directory will be created in the current path
  workDir: "tmp", // this directory will be created in the current path
  cleanup: true, // set to false to keep temporary files after merge
  skipDownload: false, // set to true to skip downloading video chunks - useful if merge step fails
  format: "ts", // the video format used by livebarn
  // Note: If ffmpeg gives you errors during the merge process, try adjusting this number to find the sweet spot
  //       For example, PANO (feed mode 4) uses higher resolution chunks, so this limit should be adjusted
  //       accordingly if using that feed mode
  maximumChunksPerMerge: 60, // the limit per ffmpeg command we try to execute for merging chunked video files
  skipMerge: false, // set to true to skip merging video chunks - useful is ffmpeg isn't installed
};

class Livebarn {
  saveStreamToFile(location, filename, data, skipDownload = false) {
    return new Promise((resolve, reject) => {
      const filePath = path.join(location, filename);
      if (skipDownload) {
        resolve(filePath);
        return;
      }
      if (data) {
        const writer = fs.createWriteStream(filePath);
        data.pipe(writer);
        let error = null;
        writer.on("error", (err) => {
          error = err;
          writer.close();
          reject(err);
        });
        writer.on("close", () => {
          if (!error) {
            resolve(filePath);
          }
          //no need to call the reject here, as it will have been called in the
          //'error' stream;
        });
      }
    });
  }

  async _doMerge(files = [], target, workPath) {
    return new Promise((resolve, reject) => {
      let command = ffmpeg()
        .on("error", (err) =>
          reject(new Error(`An error occurred merging files: ${err.message}`))
        )
        .on("end", () => resolve(target));
      // console.log(`creating list of chunk files to merge`);
      let i = 0;
      files.forEach((file) => {
        i++;
        // console.log(`adding ${file}`);
        command = command.addInput(file);
      });

      console.log(`Merging ${i} chunks to file ${target}`);
      command.mergeToFile(target, workPath);
    });
  }

  // this function is called recursively to merge an arbitrary number of chunks into a single
  // file, accounting for ffmpeg's unreliability when merging several hundred chunks at a time.
  async mergeFiles(
    files = [],
    outputPath,
    filename,
    workDir = path.join(__dirname, "tmp"),
    cleanup = false,
    format = "ts",
    maximumChunksPerMerge = 60
  ) {
    if (files.length <= maximumChunksPerMerge) {
      const mergedPath = path.join(outputPath, `${filename}.${format}`);
      console.log(`Starting final merge`);
      return await this._doMerge(files, mergedPath, workDir).then(() => {
        console.log(`Merge finished`);
        if (cleanup) {
          console.log(`Cleaning up work directory`);
          fs.rmdirSync(workDir, { recursive: true });
        }
      });
    }

    console.log(
      `Chunking ${files.length} files into batches of ${maximumChunksPerMerge} for intermediate merge`
    );
    const chunked = chunk(files, maximumChunksPerMerge);
    // set up a chunk status tracker
    const chunkStatus = {};

    // process 1 chunk at a time
    await chunked.reduce(async (memo, chunk, index) => {
      await memo;
      chunkStatus[index] = "";
      const mergedPath = path.join(
        workDir,
        `${filename}__${crypto
          .randomBytes(6)
          .toString("hex")
          .slice(0, 6)}.${format}`
      );
      console.log(`Starting merge ${index + 1}`);
      await this._doMerge(chunk, mergedPath, workDir).then((target) => {
        console.log(`Merge ${index + 1} finished`);
        chunkStatus[index] = target;
      });
    }, undefined);
    // call the function recursively if we have more merging to do
    return this.mergeFiles(
      Object.values(chunkStatus),
      outputPath,
      filename,
      workDir,
      cleanup,
      format,
      maximumChunksPerMerge
    );
  }

  async _fetchGame(options, game) {
    console.log(
      `================================================================================`
    );
    console.log(`Fetching game`);
    console.log(game);

    const client = new Client(options.username, options.password, options.uuid);
    await client.login();

    const medialists = await client
      .getMediaList(
        new MediaListRequest(game.surface, game.dateRange, game.feedMode)
      )
      // these requests will likely redirect and give us a collection of playlists
      .then((media) =>
        Promise.all(media.map((media) => client.getAmList(media.url)))
      )
      // we need to parse each playlist to get the chunk lists for a given media block
      // this will be an array of regex match arrays that we need to flatten
      .then((playlists) =>
        playlists.map((playlist) => matchUrls(playlist.data)).flat()
      );

    if (medialists.length == 0) {
      throw new Error("no videos found for the requested time and surface");
    }

    const workDir = path.resolve(options.workDir ? options.workDir : "tmp");
    if (!options.skipDownload) {
      createDirectory(workDir);
    }

    // this returns an array for each chunklist containing promises for each chunk in the list
    // that, when resolved, will be the chunk data stream
    const chunkFiles = await Promise.all(
      medialists.map(async (chunklist, index) => {
        console.log(`Fetching medialist ${index}`);

        // request each chunk list, which will be the data response containing the file content,
        // which we then scan to identify any URLs
        let requests = client
          .getChunkList(chunklist)
          .then((chunklistResponse) => matchUrls(chunklistResponse.data));
        const chunklistPath = path.resolve(
          workDir,
          getPathForUri(chunklist).name
        );

        if (options.skipDownload) {
          // if we don't want to download the chunks (maybe we already have them locally), await the
          // chunklist and map each chunk to a filesystem path
          console.log(`Skipping video download as requested`);
          return (await requests).map((chunk) =>
            path.join(chunklistPath, path.basename(url.parse(chunk).pathname))
          );
        }

        // once we know we have files to download, create a working scratch directory
        createDirectory(chunklistPath);

        return requests
          .then((chunks) => {
            console.log(`Downloading video chunklists`);
            return chunks;
          })
          .then((chunks) =>
            Promise.all(
              chunks.map((chunk) => client.getChunk(new ChunkRequest(chunk)))
            )
          )
          .then((chunksByChunklistResponses) => {
            return chunksByChunklistResponses.map(
              async (chunksByChunklistResponse) => {
                const chunksByChunklist = await chunksByChunklistResponse;
                return this.saveStreamToFile(
                  chunklistPath,
                  path.basename(
                    url.parse(chunksByChunklist.config.url).pathname
                  ),
                  chunksByChunklist.data,
                  options.skipDownload
                );
              }
            );
          })
          .then(async (chunkFilesByChunklist) => {
            console.log(`Downloading video chunks`);
            return chunkFilesByChunklist;
          })
          .then(
            async (chunkFilesByChunklist) =>
              await Promise.all(chunkFilesByChunklist)
          );
      })
    );

    if (options.skipMerge) {
      console.log(`Skipping merge as requested`);
      chunkFiles.flat().forEach((chunk) => console.log(chunk));
      return;
    }
    if (chunkFiles.flat().length == 0) {
      throw new Error("No video chunks were downloaded for this game");
    }

    // create an output directory
    const outputPath = createDirectory(
      path.resolve(options.outputDir ? options.outputDir : "videos")
    );

    console.log(`Processing ${chunkFiles.flat().length} chunks`);

    // merge all of the chunks to a single output file
    this.mergeFiles(
      chunkFiles.flat(),
      outputPath,
      game.createFilenameForGame(),
      workDir,
      options.cleanup,
      options.format,
      options.maximumChunksPerMerge
    );
  }

  async fetch(games, options) {
    const opts = {
      ..._defaultOptions,
      ...options,
    };
    if (Array.isArray(games)) {
      // process 1 game at a time
      return await games.reduce(async (memo, game) => {
        await memo;
        await this._fetchGame(opts, game);
      }, undefined);
    }
    return await this._fetchGame(opts, games);
  }
}

const livebarn = new Livebarn();
livebarn.Surface = Surface;
livebarn.Game = Game;

module.exports = livebarn;
