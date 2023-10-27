import { Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { VenomFeedPostEntity } from './VenomFeedPost.entity';

@Entity()
export class NoContentPostEntity {
	@PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
	id!: string;

	@OneToOne(() => VenomFeedPostEntity, post => post.id)
	@JoinColumn()
	post!: VenomFeedPostEntity;
}
