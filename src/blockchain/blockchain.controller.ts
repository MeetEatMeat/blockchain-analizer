import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ValidationPipe } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BlockchainDto } from './dto/create-blockchain.dto';
import { UpdateBlockchainDto } from './dto/update-blockchain.dto';

@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get('affiliates/:address/:range')
  async findAffiliates(@Param('address') address: string, @Param('range') range: number){
    return await this.blockchainService.findAffiliates(address, range);
  }

  @Post('database/:address')
  async addNewAddress(@Param('address') address: string) {
    return await this.blockchainService.addNewAddress(address);
  }
}
