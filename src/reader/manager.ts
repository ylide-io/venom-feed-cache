import express from 'express';
import { FindOptionsWhere, ILike, In } from 'typeorm';
import { adminRepository } from '../database';
import { AdminEntity } from '../entities/Admin.entity';

export const createManagerRouter = (): express.Router => {
	const router = express.Router();

	router.use((req, res, next) => {
		if (req.headers['x-code'] !== process.env.AUTH_CODE) {
			res.sendStatus(401);
			return;
		}
		next();
	});

	router.get('/', async (req, res) => {
		try {
			let from = 0;
			let to = 100;
			if (req.query.range) {
				[from, to] = JSON.parse(req.query.range as string).map(Number) as [number, number];
			}
			const skip = from;
			const take = to - from;
			let where: FindOptionsWhere<AdminEntity> | FindOptionsWhere<AdminEntity>[] | undefined;
			if (req.query.filter) {
				const filters = JSON.parse(req.query.filter as string);
				const query = filters.q as string | undefined;
				if (query) {
					where = [{ title: ILike(`%${query}%`) }, { feedId: query }, { address: ILike(`%${query}%`) }];
				}
			}
			const [admins, count] = await adminRepository.findAndCount({
				where,
				skip,
				take,
			});
			res.setHeader('Access-Control-Expose-Headers', '*');
			res.setHeader('content-range', `manager ${from}-${to}/${count}`);
			res.status(200).json(admins);
		} catch (error) {
			console.log(error);
			res.sendStatus(500);
		}
	});

	router.get('/:id', async (req, res) => {
		try {
			const admin = await adminRepository.findOneBy({ id: req.params.id });
			res.status(200).json(admin);
		} catch (error) {
			console.log(error);
			res.sendStatus(500);
		}
	});

	router.post('/', async (req, res) => {
		try {
			const admin = new AdminEntity();
			admin.createTimestamp = Math.floor(Date.now() / 1000);
			admin.password = req.body.password;
			admin.feedId = req.body.feedId;
			admin.address = req.body.address.toLowerCase();
			admin.title = req.body.title;
			admin.rank = req.body.rank;
			admin.emoji = req.body.emoji;
			admin.role = req.body.role;
			await adminRepository.save(admin);
			res.status(200).json(admin);
		} catch (error) {
			console.log(error);
			res.sendStatus(500);
		}
	});

	router.put('/:id', async (req, res) => {
		try {
			const admin = await adminRepository.findOneBy({ id: req.params.id });
			if (!admin) {
				res.status(404).json('Not found');
				return;
			}
			admin.password = req.body.password;
			admin.feedId = req.body.feedId;
			admin.address = req.body.address.toLowerCase();
			admin.title = req.body.title;
			admin.rank = req.body.rank;
			admin.emoji = req.body.emoji;
			admin.role = req.body.role;
			await adminRepository.save(admin);
			res.status(200).json(admin);
		} catch (error) {
			console.log(error);
			res.sendStatus(500);
		}
	});

	router.delete('/:id', async (req, res) => {
		try {
			const admin = await adminRepository.findOneBy({ id: req.params.id });
			if (!admin) {
				res.status(404).json('Not found');
				return;
			}
			await adminRepository.remove(admin);
			res.status(200).json(admin);
		} catch (error) {
			console.log(error);
			res.sendStatus(500);
		}
	});

	router.delete('/', async (req, res) => {
		try {
			const filters = JSON.parse(req.query.filter as string);
			const id = filters.id;
			const admins = await adminRepository.find({
				where: { id: In(id) },
			});
			if (admins.length) {
				await adminRepository.remove(admins);
			}
			res.status(200).json(admins);
		} catch (e) {
			console.error(e);
			res.sendStatus(500);
		}
	});

	return router;
};
