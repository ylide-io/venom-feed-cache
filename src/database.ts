import { DataSource } from 'typeorm';
import fs from 'fs';
//
import { VenomFeedPostEntity } from './entities/VenomFeedPost.entity';
import { PredefinedTextEntity } from './entities/PredefinedText.entity';
import { BannedAddressEntity } from './entities/BannedAddress.entity';
import { AdminEntity } from './entities/Admin.entity';

export const AppDataSource = new DataSource({
	type: 'postgres',
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
	entities: [VenomFeedPostEntity, PredefinedTextEntity, BannedAddressEntity, AdminEntity],
	subscribers: [],
	migrations: [],
	synchronize: process.env.POSTGRES_SYNC === 'true',
});

export const postRepository = AppDataSource.getRepository(VenomFeedPostEntity);
export const predefinedTextRepository = AppDataSource.getRepository(PredefinedTextEntity);
export const bannedAddressRepository = AppDataSource.getRepository(BannedAddressEntity);
export const adminRepository = AppDataSource.getRepository(AdminEntity);
