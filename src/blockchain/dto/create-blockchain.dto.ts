import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class BlockchainDto {
    @IsNumber()
    timestamp: number;

    @IsString()
    hash: string;
}
