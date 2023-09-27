import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { VenomFeedPostEntity } from './VenomFeedPost.entity';

@Entity()
export class FeedPostReactionEntity {
	@PrimaryColumn({ type: 'text' })
	@Index()
	address!: string;

	@Column()
	postId!: string;

	@ManyToOne(() => VenomFeedPostEntity, post => post.reactions)
	post!: VenomFeedPostEntity;

	@Column({ type: 'text' })
	reaction!: string;
}
