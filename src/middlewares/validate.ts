import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';

const JoiId = Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string()));

const postsStatusSchema = Joi.object({
	id: JoiId.required(),
});

const banPostSchema = Joi.object({
	id: JoiId.required(),
	secret: Joi.string().required(),
});

export const validatePostsStatus = (req: Request, res: Response, next: NextFunction) => {
	const { error } = postsStatusSchema.validate(req.query);
	if (error) {
		return res.status(400).json({ error: error.details[0].message });
	}
	next();
};

export const validateBanPost = (req: Request, res: Response, next: NextFunction) => {
	const { error } = banPostSchema.validate(req.query);
	if (error) {
		return res.status(400).json({ error: error.details[0].message });
	}
	if (req.query.secret !== process.env.ADMIN_SECRET) {
		return res.status(400).json({ error: 'Wrong admin secret' });
	}
	next();
};
