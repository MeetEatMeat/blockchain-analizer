import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ValidationPipe } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';

@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get('analisys/affiliates/:address/:range')
  async findAffiliates(@Param('address') address: string, @Param('range') range: number){
    return await this.blockchainService.findAffiliates(address, range);
  }

  @Get('analisys/transactions/count')
  async getTransactionCount() {
    return await this.blockchainService.getTransactionsCount();
  }

  @Get('analisys/token-transfers/count')
  async getTokenTransferCount() {
    return await this.blockchainService.getTokenTransferCount();
  }

  @Get('token-transfers/relations/:address/:target')
  async checkTokenTransferRelations(@Param('address') address: string, @Param('target') target: string) {
    return await this.blockchainService.checkTokenTransferRelations(address, target);
  }

  @Get('token-transfers/from-address/list/:address')
  async findERC20TransfersFromAddress(@Param('address') address: string) {
    return await this.blockchainService.findERC20TransfersFromAddress(address);
  }

  @Get('token-transfers/from-contract/list/:contractaddress')
  async findERC20TransfersFromContract(@Param('contractaddress') contractaddress: string) {
    return await this.blockchainService.findERC20TransfersFromContract(contractaddress);
  }

  @Get('token-transfers/token-from-address/list/:tokenaddress/:address')
  async findTokenTransfersFromAddress(@Param('tokenaddress') tokenaddress: string, @Param('address') address: string) {
    return await this.blockchainService.findTokenTransfersFromAddress(tokenaddress, address);
  }

}
