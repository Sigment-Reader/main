import { Router } from 'express';
import { parseUserQuery } from '../controllers/userQueryController.js';
import { queryOpenAIChat } from '../controllers/aiController.js'; // Import the AI controller

const router = Router();

router.post(
  '/news-query',
  parseUserQuery,
  queryOpenAIChat,
  (req, res, next) => {
    res.status(200).json(res.locals.articles);
  }
);

export default router;
