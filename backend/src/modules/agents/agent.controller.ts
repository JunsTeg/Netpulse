import { Request, Response } from 'express';
import { Agent } from './agent.model';

export const listAgents = async (req: Request, res: Response) => {
  const agents = await Agent.findAll();
  res.json(agents);
}

export const runAgent = async (req: Request, res: Response) => {
  // TODO: utiliser executor
  res.json({ message: 'Agent lancé (mock)' });
}