import { PartialType } from '@nestjs/mapped-types';
import { BlockchainDto } from './create-blockchain.dto';
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class UpdateBlockchainDto extends PartialType(BlockchainDto) {
    @IsString()
    hash: string;
}
