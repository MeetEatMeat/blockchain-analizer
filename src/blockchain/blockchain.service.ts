import { Injectable, NotFoundException } from '@nestjs/common';
import { BlockchainDto } from './dto/create-blockchain.dto';
import { UpdateBlockchainDto } from './dto/update-blockchain.dto';
import checkAffiliates from './libs/analize';

@Injectable()
export class BlockchainService {
  private DATA = [{
    timestamp: 1632800000000,
    hash: ""
  }]

  create(dto: BlockchainDto) {
    this.DATA.push({
      timestamp: dto.timestamp,
      hash: dto.hash
    })
    return this.DATA;
  }

  getData() {
    return this.DATA
  }

  findOne(id: number) {
    return `This action returns a #${id} blockchain`;
  }

  update(timestamp: string, dto: UpdateBlockchainDto) {
    const transaction = this.DATA.find((data) => data.timestamp === +timestamp);
    if (!transaction) {
      throw new NotFoundException(`Transaction with timestamp ${timestamp} not found`);
    }
    transaction.hash = dto.hash;
    return transaction;
  }

  remove(id: number) {
    return `This action removes a #${id} blockchain`;
  }
}
