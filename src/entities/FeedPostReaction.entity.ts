import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { VenomFeedPostEntity } from './VenomFeedPost.entity';

@Entity()
export class FeedPostReactionEntity {
	@PrimaryColumn({ type: 'text' })
	address!: string;

	@ManyToOne(() => VenomFeedPostEntity, post => post.reactions)
	post!: VenomFeedPostEntity;

	@Column({ type: 'text' })
	reaction!: string;
}
