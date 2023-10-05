import express from 'express';
import { userRepository } from '../database';
import { UserEntity } from '../entities/User.entity';
import { validateSubscription } from '../middlewares/validate';
import { SubscriptionPayload } from '../types';
import { authorizationFactory } from '../utils/ylide-auth';

export const createSubscriptionRoute = (): express.Router => {
	const router = express.Router();

	const authorize = authorizationFactory();

	router.post('/', authorize, validateSubscription, async (req, res) => {
		try {
			const address = req.userAddress;
			const { subscription } = req.body as SubscriptionPayload;
			const userExists = await userRepository.findOneBy({ address });
			if (userExists) {
				userExists.pushSubscription = subscription;
				await userRepository.save(userExists);
			} else {
				const newUser = new UserEntity();
				newUser.address = address;
				newUser.pushSubscription = subscription;
				await userRepository.save(newUser);
			}
			res.sendStatus(200);
		} catch (error) {
			console.log(error);
			res.sendStatus(500);
		}
	});

	router.delete('/', authorize, async (req, res) => {
		try {
			const address = req.userAddress;
			const userExists = await userRepository.findOneBy({ address });
			if (userExists) {
				await userRepository.remove(userExists);
				res.sendStatus(200);
				return;
			} else {
				res.sendStatus(404);
				return;
			}
		} catch (error) {
			console.log(error);
			res.sendStatus(500);
		}
	});

	return router;
};
