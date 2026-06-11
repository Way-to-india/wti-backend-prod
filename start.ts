import './index.ts';
import { app } from './index.ts';

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
