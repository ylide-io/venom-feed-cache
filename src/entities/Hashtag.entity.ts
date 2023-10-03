import { Entity, ManyToMany, PrimaryColumn } from 'typeorm';
import { VenomFeedPostEntity } from './VenomFeedPost.entity';

@Entity()
export class HashtagEntity {
	@PrimaryColumn({ type: 'varchar', length: 255 })
	name!: string;

	@ManyToMany(() => VenomFeedPostEntity, post => post.hashtags)
	posts!: VenomFeedPostEntity[] | string[];
}
