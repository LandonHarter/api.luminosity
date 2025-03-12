import { BlobServiceClient } from "@azure/storage-blob";
import { exec } from "child_process";
import { promises as fs } from "fs";
import { Hono } from "hono";
import { env } from "hono/adapter";

const app = new Hono();

app.post("/video", async (c) => {
	const { STORAGE_CONNECTION_STRING } = env<{
		STORAGE_CONNECTION_STRING: string;
	}>(c, "node");

	const blobServiceClient = BlobServiceClient.fromConnectionString(
		STORAGE_CONNECTION_STRING
	);
	const renderedContainer = blobServiceClient.getContainerClient("rendered");

	const body = await c.req.parseBody();

	const code = body["code"] as string;
	const className = body["className"] as string;
	if (!code || !className) {
		return c.json({ error: "Missing code or className" });
	}

	const fileName = Date.now();
	const pyFile = `./temp/${Date.now()}.py`;
	await fs.writeFile(pyFile, code);

	const videoError = await new Promise((resolve, reject) => {
		exec(
			`manim -qm --fps 24 ${pyFile} ${className} --disable_caching --format mp4 --flush_cache --output_file video --media_dir ./output/${fileName}/`,
			(error, stdout, stderr) => {
				if (error) {
					resolve(stderr);
				}
				resolve(null);
			}
		);
	});

	const mediaDir = `./output/${fileName}/`;
	if (videoError) {
		await fs.unlink(pyFile);
		await fs.rm(mediaDir, { recursive: true, force: true });
		return c.json({
			error: videoError,
		});
	}

	const videoPath = `${mediaDir}/videos/${fileName}/720p24/video.mp4`;
	const videoClient = renderedContainer.getBlockBlobClient(`${fileName}.mp4`);
	await videoClient.uploadFile(videoPath, {
		blobHTTPHeaders: {
			blobContentType: "video/mp4",
		},
	});

	await fs.unlink(pyFile);
	await fs.rm(mediaDir, { recursive: true, force: true });

	return c.json({
		video: videoClient.url,
	});
});

export default app;
