/** @format */

import * as utils from "@actions/cache/lib/internal/cacheUtils";
import { createTar, listTar } from "@actions/cache/lib/internal/tar";
import * as core from "@actions/core";
import * as path from "path";
import { getCacheHitOutput, getInputAsArray, newMinio } from "./utils";

process.on("uncaughtException", (e) => core.info("warning: " + e.message));

async function saveCache() {
  try {
    const bucket = core.getInput("bucket", { required: true });
    const key = core.getInput("key", { required: true });
    const paths = getInputAsArray("path");
    core.info(`
      saveCache

      bucket = ${bucket}
      key = ${key}
      paths = ${paths}
    `);

    const isCacheHit = getCacheHitOutput(key);
    core.info(`isCacheHit ${isCacheHit}`);
    if (isCacheHit) {
      core.info(`Found cache hit for key ${key}, ignore uploading`);
    } else {
      core.info(`Cache not found for key ${key}, start uploading`);
      try {
        const mc = newMinio();

        const compressionMethod = await utils.getCompressionMethod();
        core.info(`Compression method ${compressionMethod}`);
        const cachePaths = await utils.resolvePaths(paths);
        core.info(`Cache Paths: ${JSON.stringify(cachePaths)}`);

        const archiveFolder = await utils.createTempDirectory();
        core.info(`archiveFolder: ${archiveFolder}`);

        const cacheFileName = utils.getCacheFileName(compressionMethod); // cache.tzst
        core.info(`cacheFileName: ${cacheFileName}`);

        const archivePath = path.join(archiveFolder, cacheFileName); // /Volumes/MacintoshHD2/actions-runner/_work/_temp/d251b5bc-37a0-44b0-8df1-ad374bb5440a/cache.tzst
        core.info(`archivePath: ${archivePath}`);

        await createTar(archiveFolder, cachePaths, compressionMethod);
        if (core.isDebug()) {
          await listTar(archivePath, compressionMethod);
        }

        const object = path.join(key, cacheFileName);

        core.info(`Uploading tar to s3. Bucket: ${bucket}, Object: ${object}`);
        await mc.fPutObject(bucket, object, archivePath, {});
        core.info("Cache saved to s3 successfully");
      } catch (e: any) {
        core.info("Save s3 cache failed: " + e.message);
      }
    }
  } catch (e: any) {
    core.info("warning: " + e.message);
  }
}

saveCache();
