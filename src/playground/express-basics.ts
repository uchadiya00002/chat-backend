import express, { Request, Response } from 'express';

const app = express();

app.use(express.json());

// --- Route 1: Basic GET ---
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// --- Route 2: Route parameters ---
// :id is a named capture — Express extracts it into req.params.id
app.get('/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  res.json({ message: `Fetching user ${id}` });
});

// --- Route 3: Query strings ---
// /search?q=hello&limit=10 → req.query = { q: 'hello', limit: '10' }
// Note: ALL query string values come in as strings, even numbers
app.get('/search', (req: Request, res: Response) => {
  const { q, limit } = req.query;
  res.json({ query: q, limit: Number(limit) || 20 });
});

// --- Route 4: POST with body ---
app.post('/users', (req: Request, res: Response) => {
  const { name, email } = req.body;
  // In a real app, you'd validate and save to DB here
  res.status(201).json({ message: 'User created', data: { name, email } });
});

app.listen(3001, () => {
  console.log('Express playground running on http://localhost:3001');
});