// src/playground/router-demo.ts

import express, { Request, Response, Router } from 'express';

const app = express();
app.use(express.json());

// --- Users router ---
// This knows nothing about the /users prefix — that's decided at mount time
const usersRouter: Router = express.Router();

usersRouter.get('/', (req: Request, res: Response) => {
  res.json({ users: [] });
});

usersRouter.get('/:id', (req: Request, res: Response) => {
  res.json({ user: { id: req.params.id } });
});

usersRouter.post('/', (req: Request, res: Response) => {
  res.status(201).json({ created: req.body });
});

usersRouter.delete('/:id', (req: Request, res: Response) => {
  res.status(204).send();
});

// --- Workspaces router ---
const workspacesRouter: Router = express.Router();

workspacesRouter.get('/', (req: Request, res: Response) => {
  res.json({ workspaces: [] });
});

workspacesRouter.post('/', (req: Request, res: Response) => {
  res.status(201).json({ created: req.body });
});

// Mount routers under their prefixes — THIS is where the path is set
app.use('/api/users', usersRouter);
app.use('/api/workspaces', workspacesRouter);

app.listen(3003, () => console.log('Router demo on http://localhost:3003'));