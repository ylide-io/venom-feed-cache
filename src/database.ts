import fs from 'fs';
//
import { DotenvParseOutput } from 'dotenv';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
//
import { AdminEntity } from './entities/Admin.entity';
import { BannedAddressEntity } from './entities/BannedAddress.entity';
import { FeedEntity } from './entities/Feed.entity';
import { FeedPostReactionEntity } from './entities/FeedPostReaction.entity';
import { HashtagEntity } from './entities/Hashtag.entity';
import { PredefinedTextEntity } from './entities/PredefinedText.entity';
import { UserEntity } from './entities/User.entity';
import { VenomFeedPostEntity } from './entities/VenomFeedPost.entity';
import { NoContentPostEntity } from './entities/NoContentPost';

export const createMessageBus = async (env: DotenvParseOutput) => {
	const redis = new Redis({
		tls: {
			port: Number(env.REDIS_PORT), // Redis port
			host: env.REDIS_HOST, // Redis host
		},
		username: env.REDIS_USER, // needs Redis >= 6
		password: env.REDIS_PASS,
		db: Number(env.REDIS_NAME), // Defaults to 0
	});

	return { redis };
};

export const AppDataSource = new DataSource({
	type: 'postgres',
	poolSize: 3,
	host: process.env.POSTGRES_HOST,
	port: Number(process.env.POSTGRES_PORT),
	username: process.env.POSTGRES_USER,
	password: process.env.POSTGRES_PASSWORD,
	database: process.env.POSTGRES_DB,
	schema: process.env.POSTGRES_SCHEMA,
	ssl:
		process.env.POSTGRES_SSL === 'true'
			? {
					ca: fs.readFileSync('./ca-certificate.crt', 'utf-8'),
			  }
			: false,
	// logging: true,
	entities: [
		VenomFeedPostEntity,
		PredefinedTextEntity,
		BannedAddressEntity,
		AdminEntity,
		FeedEntity,
		FeedPostReactionEntity,
		HashtagEntity,
		UserEntity,
		NoContentPostEntity,
	],
	subscribers: [],
	migrations: [],
	synchronize: process.env.POSTGRES_SYNC === 'true',
	cache: true,
});

export const postRepository = AppDataSource.getRepository(VenomFeedPostEntity);
export const noContentRepository = AppDataSource.getRepository(NoContentPostEntity);
export const predefinedTextRepository = AppDataSource.getRepository(PredefinedTextEntity);
export const bannedAddressRepository = AppDataSource.getRepository(BannedAddressEntity);
export const adminRepository = AppDataSource.getRepository(AdminEntity);
export const feedRepository = AppDataSource.getRepository(FeedEntity);
export const reactionRepository = AppDataSource.getRepository(FeedPostReactionEntity);
export const hashtagRepository = AppDataSource.getRepository(HashtagEntity);
export const userRepository = AppDataSource.getRepository(UserEntity);
