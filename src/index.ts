import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import render from "./render.js";

const app = new Hono()

app.route("/render", render);

serve({
  fetch: app.fetch,
  port: 3000
});
