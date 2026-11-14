import express, { type Express, type Request } from "express";

export const app: Express = express();

app.use(express.json());

app.get('/', (_: Request, res) => {
  res.send('Hello World!');
});

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});