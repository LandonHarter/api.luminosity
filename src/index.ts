import { serve } from "@hono/node-server";
import dotenv from "dotenv";
import { Hono } from "hono";
import render from "./render.js";

dotenv.config();

const app = new Hono();

app.route("/render", render);

serve({
	fetch: app.fetch,
	port: 3001,
}).on("listening", () => {
	console.log("Listening on port 3001");
});
