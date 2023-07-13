import { adminRepository } from '../database';
import { AdminEntity } from '../entities/Admin.entity';
import { FeedEntity } from '../entities/Feed.entity';

export let admins: Record<string, AdminEntity[]> = {};

export const updateAdmins = async (feed: FeedEntity) => {
	const _admins = await adminRepository.find({
		where: { feedId: feed.feedId },
	});
	admins[feed.feedId] = _admins;
};
