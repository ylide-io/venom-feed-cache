import express from 'express';
import { feeds, getFeedComissions } from '../local-db/feeds';
import { FeedEntity } from '../entities/Feed.entity';
import { feedRepository } from '../database';

export const createFeedsRouter: () => Promise<{ router: express.Router }> = async () => {
	const router = express.Router();

	router.get('/', async (req, res) => {
		const { parentFeedId: parentFeedIdRaw } = req.query;
		if (
			parentFeedIdRaw &&
			(typeof parentFeedIdRaw !== 'string' ||
				!parentFeedIdRaw.match(/^[0-9a-f]+$/) ||
				parentFeedIdRaw.length !== 64)
		) {
			return res.status(400).json({ error: 'Invalid parentFeedId' });
		}

		const parentFeedId = parentFeedIdRaw as string | undefined;

		if (!parentFeedId) {
			return res.json(feeds.filter(f => !f.parentFeedId));
		} else {
			const feed = feeds.find(f => f.feedId === parentFeedId);
			if (!feed) {
				return res.status(404).json({ error: 'Parent feed not found' });
			}
			return res.json(feeds.filter(f => f.parentFeedId === feed.feedId));
		}
	});

	router.post('/', async (req, res) => {
		return res.status(400).json({ error: 'Only for super-admins' });
		// const { feedId, parentFeedId: parentFeedIdRaw, title, description, logoUrl } = req.body;
		// if (!feedId || !title || !description || !logoUrl) {
		// 	return res.status(400).json({ error: 'Missing required fields' });
		// }
		// if (typeof feedId !== 'string' || !feedId.match(/^[0-9a-f]+$/) || feedId.length !== 64) {
		// 	return res.status(400).json({ error: 'Invalid feedId' });
		// }
		// const exists = feeds.find(f => f.feedId === feedId);
		// if (exists) {
		// 	return res.status(400).json({ error: 'Feed already exists' });
		// }
		// if (
		// 	parentFeedIdRaw &&
		// 	(typeof parentFeedIdRaw !== 'string' ||
		// 		!parentFeedIdRaw.match(/^[0-9a-f]+$/) ||
		// 		parentFeedIdRaw.length !== 64)
		// ) {
		// 	return res.status(400).json({ error: 'Invalid parentFeedId' });
		// }
		// const parentFeedId: string | null = parentFeedIdRaw || null;

		// const feed = new FeedEntity();
		// feed.feedId = feedId;
		// feed.parentFeedId = parentFeedId;
		// feed.title = title;
		// feed.description = description;
		// feed.logoUrl = logoUrl;
		// await feedRepository.save(feed);
		// feeds.push(feed);
		// return res.json(feed);
	});

	router.put('/:feedId', async (req, res) => {
		return res.status(400).json({ error: 'Only for super-admins' });
		// const { feedId } = req.params;
		// const { title, description, logoUrl, comissions } = req.body;
		// if (!title && !description && !logoUrl && !comissions) {
		// 	return res.status(400).json({ error: 'Missing required fields' });
		// }
		// if (typeof feedId !== 'string' || !feedId.match(/^[0-9a-f]+$/) || feedId.length !== 64) {
		// 	return res.status(400).json({ error: 'Invalid feedId' });
		// }
		// const feed = feeds.find(f => f.feedId === feedId);
		// if (!feed) {
		// 	return res.status(404).json({ error: 'Feed not found' });
		// }
		// if (title) {
		// 	feed.title = title;
		// }
		// if (description) {
		// 	feed.description = description;
		// }
		// if (logoUrl) {
		// 	feed.logoUrl = logoUrl;
		// }
		// if (comissions) {
		// 	feed.comissions = comissions;
		// }
		// await feedRepository.save(feed);
		// return res.json(feed);
	});

	router.get('/:feedId/comissions', async (req, res) => {
		const { feedId } = req.params;
		try {
			const comissions = getFeedComissions(feedId);
			return res.json(comissions);
		} catch (error: any) {
			return res.status(500).json({ error: error?.message });
		}
	});

	return { router };
};
