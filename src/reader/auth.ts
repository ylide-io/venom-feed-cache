import express from 'express';
import { AuthorizationPayload } from '../types';
import { authenticationFactory } from '../utils/ylide-auth';

export const createAuthRouter: () => Promise<{ router: express.Router }> = async () => {
	const router = express.Router();

	const ylideAuthenticate = authenticationFactory();

	router.post('/auth', async (req, res) => {
		const token = await ylideAuthenticate(req.body as AuthorizationPayload);
		if (!token) {
			return res.status(401).json({ error: 'Not authenticated' });
		}
		res.status(200).json({ token });
	});

	return { router };
};
