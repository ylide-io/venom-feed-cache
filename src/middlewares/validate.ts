import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { SubscriptionPayload } from '../types';

const JoiId = Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string()));

const postsStatusSchema = Joi.object({
	id: JoiId.required(),
});

const adminSchema = Joi.object({
	secret: Joi.string().required(),
});

const banPostSchema = Joi.object({
	id: JoiId.required(),
	secret: Joi.string().required(),
});

const banAddressesSchema = Joi.object({
	address: JoiId.required(),
	secret: Joi.string().required(),
});

export const validatePostsStatus = (req: Request, res: Response, next: NextFunction) => {
	const { error } = postsStatusSchema.validate(req.query);
	if (error) {
		return res.status(400).json({ error: error.details[0].message });
	}
	next();
};

export const validateAdmin = (req: Request, res: Response, next: NextFunction) => {
	const { error } = adminSchema.validate(req.query);
	if (error) {
		return res.status(400).json({ error: error.details[0].message });
	}
	if (typeof req.query.secret !== 'string' || !process.env.ADMIN_SECRET?.split(',').includes(req.query.secret)) {
		return res.status(400).json({ error: 'Wrong admin secret' });
	}
	next();
};

export const validateBanAddresses = (req: Request, res: Response, next: NextFunction) => {
	const { error } = banAddressesSchema.validate(req.query);
	if (error) {
		return res.status(400).json({ error: error.details[0].message });
	}
	if (typeof req.query.secret !== 'string' || !process.env.ADMIN_SECRET?.split(',').includes(req.query.secret)) {
		return res.status(400).json({ error: 'Wrong admin secret' });
	}
	next();
};

export const validateBanPost = (req: Request, res: Response, next: NextFunction) => {
	const { error } = banPostSchema.validate(req.query);
	if (error) {
		return res.status(400).json({ error: error.details[0].message });
	}
	if (typeof req.query.secret !== 'string' || !process.env.ADMIN_SECRET?.split(',').includes(req.query.secret)) {
		return res.status(400).json({ error: 'Wrong admin secret' });
	}
	next();
};

const subscriptionSchema = Joi.object<SubscriptionPayload>({
	subscription: Joi.object({
		endpoint: Joi.string(),
		expirationTime: Joi.number().allow(null).optional(),
		keys: Joi.object({
			p256dh: Joi.string(),
			auth: Joi.string(),
		}),
	}).required(),
});

export const validateSubscription = (req: Request, res: Response, next: NextFunction) => {
	const { error } = subscriptionSchema.validate(req.body);
	if (error) {
		return res.status(400).json({ error: error.details[0].message });
	}
	next();
};
