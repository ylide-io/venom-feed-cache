import express from 'express';
import { postRepository, bannedAddressRepository } from '../database';
import { bannedAddresses } from '../local-db/bannedAddresses';
import { feeds } from '../local-db/feeds';
import { validateBanPost, validateBanAddresses } from '../middlewares/validate';
import { posts } from '../local-db/posts';
import { updatePostsInAllFeeds } from '../local-db';

export const createAdminRouter: () => Promise<{ router: express.Router }> = async () => {
	const router = express.Router();

	router.post('/ban-posts', validateBanPost, async (req, res) => {
		const ids = typeof req.query.id === 'string' ? [req.query.id] : (req.query.id as string[]);
		await postRepository.update(ids, { banned: true });
		for (const id of ids) {
			for (const feed of feeds) {
				const idx = posts[feed.feedId] ? posts[feed.feedId].findIndex(p => p.id === id) : -1;
				if (idx !== -1) {
					posts[feed.feedId].splice(idx, 1);
				}
			}
		}
		res.sendStatus(201);
	});

	router.post('/approve-posts', validateBanPost, async (req, res) => {
		const ids = typeof req.query.id === 'string' ? [req.query.id] : (req.query.id as string[]);
		await postRepository.update(ids, { isApproved: true });
		res.sendStatus(201);
	});

	router.post('/ban-addresses', validateBanAddresses, async (req, res) => {
		const addresses = typeof req.query.address === 'string' ? [req.query.address] : (req.query.address as string[]);
		const newAddresses = addresses.filter(a => !bannedAddresses.includes(a));
		if (newAddresses.length) {
			await bannedAddressRepository.insert(newAddresses.map(address => ({ address })));
			await bannedAddressRepository.query(
				`UPDATE venom_feed_post_entity SET banned = true, "isAutobanned" = true WHERE sender IN (${newAddresses
					.map(a => `'${a}'`)
					.join(', ')})`,
			);
			await updatePostsInAllFeeds();
		}
		res.sendStatus(201);
	});

	router.delete('/unban-addresses', validateBanAddresses, async (req, res) => {
		const addresses = typeof req.query.address === 'string' ? [req.query.address] : (req.query.address as string[]);
		await bannedAddressRepository.delete(addresses);
		await updatePostsInAllFeeds();
		res.sendStatus(201);
	});

	router.delete('/unban-posts', validateBanPost, async (req, res) => {
		const ids = typeof req.query.id === 'string' ? [req.query.id] : (req.query.id as string[]);
		await postRepository.update(ids, { banned: false });
		res.sendStatus(204);
	});

	return { router };
};
