import { Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class PredefinedTextEntity {
	@PrimaryColumn({ type: 'text' })
	text!: string;
}
