import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { VenomFeedPostEntity } from './VenomFeedPost.entity';

@Entity()
export class FeedPostReactionEntity {
	@PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
	id!: string;

	@Column({ type: 'text' })
	@Index()
	address!: string;

	@Column()
	postId!: string;

	@ManyToOne(() => VenomFeedPostEntity, post => post.reactions)
	post!: VenomFeedPostEntity;

	@Column({ type: 'text' })
	reaction!: string;
}
