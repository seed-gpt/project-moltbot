import 'dotenv/config';
import { createApp } from './app.js';

const PORT = process.env.PORT || 3002;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Moltmail service listening on port ${PORT}`);
});
