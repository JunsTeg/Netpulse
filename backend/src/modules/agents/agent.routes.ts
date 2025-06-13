import { Router } from 'express';
import { listAgents, runAgent } from './agent.controller';

const router = Router();

router.get('/', listAgents);
router.post('/:id/run', runAgent);

export default router;