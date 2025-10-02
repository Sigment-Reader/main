import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { ServerError } from '../server/types.js';
import parseUserQuery from './routes/newsRouter.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', parseUserQuery);

const errorHandler: ErrorRequestHandler = (
  err: ServerError,
  _req,
  res,
  _next
) => {
  const defaultErr: ServerError = {
    log: 'Express error handler caught unknown middleware error',
    status: 500,
    message: { err: 'An error occurred' },
  };
  const errorObj: ServerError = { ...defaultErr, ...err };
  console.log(errorObj.log);
  res.status(errorObj.status).json(errorObj.message);
};

app.use(errorHandler);

export default app;
