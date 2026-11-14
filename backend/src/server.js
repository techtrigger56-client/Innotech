import app from './app.js';
import { initializeDatabase } from './db.js';

const port = Number(process.env.PORT || 4000);

await initializeDatabase();

app.listen(port, () => {
  console.log(`Innotech backend running at http://localhost:${port}`);
});
