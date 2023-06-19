import { Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class BannedAddressEntity {
	@PrimaryColumn({ type: 'text' })
	address!: string;
}
