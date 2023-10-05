import { Column, Entity, PrimaryColumn } from 'typeorm';
import webpush from 'web-push';

@Entity()
export class UserEntity {
	@PrimaryColumn({ type: 'varchar', length: 255 })
	address!: string;

	@Column({ type: 'jsonb' })
	pushSubscription!: webpush.PushSubscription;
}
