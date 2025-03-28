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

	console.log("rendering " + pyFile);

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
		console.log(videoError);

		try {
			await fs.unlink(pyFile);
			await fs.rm(mediaDir, { recursive: true, force: true });
		} catch (e) {
			console.log(e);
		}
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

	try {
		await fs.unlink(pyFile);
		await fs.rm(mediaDir, { recursive: true, force: true });
	} catch (e) {
		console.log(e);
	}

	return c.json({
		video: videoClient.url,
	});
});

app.post("/stitch", async (c) => {
	const { STORAGE_CONNECTION_STRING } = env<{
		STORAGE_CONNECTION_STRING: string;
	}>(c, "node");
	const blobServiceClient = BlobServiceClient.fromConnectionString(
		STORAGE_CONNECTION_STRING
	);
	const renderedContainer = blobServiceClient.getContainerClient("rendered");

	const body = await c.req.parseBody();
	const videoUrls = JSON.parse(body["videos"] as string) as string[];

	console.log(body);

	const fileName = Date.now();
	const cwd = process.cwd();
	const mediaDir = `${cwd}/output/${fileName}/`;

	await fs.mkdir(mediaDir);

	const videoPaths = [];
	for (const videoUrl of videoUrls) {
		if (!videoUrl) {
			continue;
		}
		console.log(videoUrl);
		const response = await fetch(videoUrl);
		const video = await response.arrayBuffer();
		const videoPath = `${mediaDir}/${Date.now()}.mp4`;
		await fs.writeFile(videoPath, Buffer.from(video), {
			encoding: "binary",
		});
		videoPaths.push(videoPath);
	}

	const fileListContent = videoPaths
		.map((videoPath) => (videoPath !== null ? `file '${videoPath}'` : ""))
		.join("\n");
	const fileList = `${mediaDir}/fileList.txt`;
	await fs.writeFile(fileList, fileListContent);

	const stitchedVideo = `${mediaDir}/stitched.mp4`;
	const stitchError = await new Promise((resolve, reject) => {
		exec(
			`ffmpeg -f concat -safe 0 -i ${fileList} -c copy ${stitchedVideo}`,
			(error, stdout, stderr) => {
				if (error) {
					resolve(stderr);
				}
				resolve(null);
			}
		);
	});

	if (stitchError) {
		try {
			await fs.rm(mediaDir, { recursive: true });
		} catch (e) {
			console.log(e);
		}
		return c.json({
			error: stitchError,
		});
	}

	const stitchedClient = renderedContainer.getBlockBlobClient(
		`${fileName}.mp4`
	);
	await stitchedClient.uploadFile(stitchedVideo, {
		blobHTTPHeaders: {
			blobContentType: "video/mp4",
		},
	});

	try {
		await fs.rmdir(mediaDir, { recursive: true });
	} catch (e) {
		console.log(e);
	}

	return c.json({
		video: stitchedClient.url,
	});
});

export default app;
