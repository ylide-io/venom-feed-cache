import { DataSource, MoreThan } from 'typeorm';
import { VenomFeedPostEntity } from '../entities/VenomFeedPost.entity';
import { isGoodPost, getNotGoodWords } from './goodWords';

export const manuallyProcessGoodPosts = async (db: DataSource) => {
	const rep = db.getRepository(VenomFeedPostEntity);
	let lastTimestmap = 0;
	let i = 0;
	let bad = 0;
	while (true) {
		const posts = await rep.find({
			where: {
				banned: false,
				isApproved: false,
				isPredefined: false,
				isAutobanned: false,
				createTimestamp: MoreThan(lastTimestmap),
				// sender: '0:444a4820e0638a6e647d83b03c1124271a3e3f1167ad0711c5caa2b40a99e785',
			},
			order: {
				createTimestamp: 'ASC',
			},
			take: 1000,
		});
		if (!posts.length) {
			console.log('Good posts in total: ' + i);
			console.log('Bad posts in total: ' + bad);
			return;
		}
		lastTimestmap = posts.at(-1)!.createTimestamp;
		for (const post of posts) {
			if (isGoodPost(post.contentText)) {
				i++;
				post.isApproved = true;
				await rep.save(post);
				console.log('Good post found: ', post.contentText);
			} else {
				bad++;
				console.log(
					'Bad post: ' + post.contentText,
					' bad words: ' +
						getNotGoodWords(post.contentText)
							.map(t => JSON.stringify(t))
							.join(', '),
				);
				// await asyncDelay(1000);
			}
		}
		// return;
	}
};
